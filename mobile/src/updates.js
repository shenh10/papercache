// 版本检查：站点 /download/app.json 由部署流程写入，build 号比本机大就提示更新
import { App } from '@capacitor/app';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { SITE } from './site.js';

export const DOWNLOAD_URL = SITE + '/download/PaperCache.apk';

class Updates extends EventTarget {
  constructor() {
    super();
    this.current = null; // { version, build }
    this.latest = null;  // app.json
  }

  get available() {
    return !!(this.current && this.latest && this.latest.build > this.current.build);
  }

  async check() {
    if (!Capacitor.isNativePlatform()) return;
    const info = await App.getInfo();
    this.current = { version: info.version, build: Number(info.build) };
    const res = await CapacitorHttp.get({ url: SITE + '/download/app.json', responseType: 'json', headers: { 'Cache-Control': 'no-cache' } });
    if (res.status === 200) this.latest = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
    this.dispatchEvent(new CustomEvent('change'));
  }
}

export const updates = new Updates();
