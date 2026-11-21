// 版本检查与应用内自动更新：站点 /download/app.json 由部署流程写入，build 号比本机大就提示更新。
// 更新包（APK 直链带 CORS 头）在 WebView 里直接 fetch 下载（有进度），存缓存目录后交给原生安装器
import { App } from '@capacitor/app';
import { Capacitor, CapacitorHttp, registerPlugin } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { SITE } from './site.js';
import { library } from './library.js';
import { supabase } from './supabase.js';

export const DOWNLOAD_URL = SITE + '/download/PaperCache.apk';
const APK_PATH = 'updates/PaperCache.apk';

const ApkInstaller = registerPlugin('ApkInstaller');

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(new Error('读取下载内容失败'));
    reader.readAsDataURL(blob);
  });
}

class Updates extends EventTarget {
  constructor() {
    super();
    this.current = null;   // { version, build }
    this.latest = null;    // app.json
    this.progress = null;  // null=空闲；0~1=下载进度；-1=下载中但未知总大小
    this.apkReady = false; // 新 APK 已下载，可以安装
  }

  get available() {
    return !!(this.current && this.latest && this.latest.build > this.current.build);
  }

  get downloading() {
    return this.progress !== null;
  }

  changed(what) {
    this.dispatchEvent(new CustomEvent('change', { detail: what }));
  }

  async check() {
    if (!Capacitor.isNativePlatform()) return;
    const info = await App.getInfo();
    this.current = { version: info.version, build: Number(info.build) };
    // 带时间戳绕开任何 CDN 缓存层（曾有 app.json 被 Cloudflare 缓存 4 小时导致检测不到新版本）
    const res = await CapacitorHttp.get({ url: SITE + '/download/app.json?t=' + Date.now(), responseType: 'json', headers: { 'Cache-Control': 'no-cache' } });
    if (res.status === 200) this.latest = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
    this.changed('check');
    // 检查到新版本时自动在后台下载，下完由 main.js 提示安装
    if (this.available && library.settings.autoUpdate && !this.apkReady) {
      this.download().catch(() => {});
    }
  }

  // 下载新 APK 到缓存目录。进度通过 change 事件广播，界面显示进度条
  async download() {
    if (this.downloading || !this.latest) return;
    this.progress = -1;
    this.changed('download');
    // 下载量埋点：匿名写入，失败不影响下载
    supabase.from('app_downloads')
      .insert({ source: 'update', from_build: this.current?.build || null, target_build: this.latest.build })
      .catch(() => {});
    try {
      const res = await fetch(DOWNLOAD_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const total = Number(res.headers.get('content-length')) || 0;
      const reader = res.body.getReader();
      const chunks = [];
      let got = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        got += value.length;
        this.progress = total ? got / total : -1;
        this.changed('download');
      }
      const blob = new Blob(chunks);
      // APK 是 zip 包，魔术字节 PK；站点偶尔会用 HTML 兜底 404，校验一下再装
      const head = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
      if (head[0] !== 0x50 || head[1] !== 0x4b) throw new Error('下载的文件不是有效的 APK');
      await Filesystem.writeFile({
        path: APK_PATH, directory: Directory.Cache, recursive: true,
        data: await blobToBase64(blob),
      });
      this.progress = null;
      this.apkReady = true;
      this.changed('downloaded');
    } catch (e) {
      this.progress = null;
      this.error = e.message;
      this.changed('error');
      throw e;
    }
  }

  // 调起系统安装器。首次会跳系统设置让用户允许「安装未知应用」，返回后重试即可
  async install() {
    if (!this.apkReady) throw new Error('还没下载完');
    const res = await ApkInstaller.install({ path: APK_PATH });
    if (res && res.needsPermission) this.changed('permission');
    else this.changed('install');
  }
}

export const updates = new Updates();
