// 本机书架：论文目录缓存、离线文章文件、阅读进度、设置。全部按站内 post_url 索引
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { fetchAllPosts, fetchAllSlides, fetchArticlePage, articleHtml } from './site.js';
import { siteStyle } from './sitestyle.js';

const POSTS_FILE = 'catalog/posts.json';
const DEFAULT_SETTINGS = { autoDownloadFavorites: true, cellularDownload: false, fontScale: 1, theme: 'light', autoUpdate: true };

function articleFile(postUrl) {
  return 'articles/' + postUrl.replace(/^\/+/, '').replace(/\.html$/, '').replace(/[^a-zA-Z0-9_-]+/g, '_') + '.html';
}

async function readPref(key, fallback) {
  const { value } = await Preferences.get({ key });
  if (!value) return fallback;
  try { return JSON.parse(value); } catch (e) { return fallback; }
}

function writePref(key, value) {
  return Preferences.set({ key, value: JSON.stringify(value) });
}

class Library extends EventTarget {
  constructor() {
    super();
    this.posts = new Map();
    this.slides = new Map();
    this.postsFetchedAt = 0;
    this.downloads = {};   // post_url → { savedAt, bytes }
    this.progress = {};    // post_url → { heading, within, percent, label, updatedAt }
    this.settings = { ...DEFAULT_SETTINGS };
    this.pending = new Map(); // post_url → 进行中的下载 Promise
  }

  changed(what) {
    this.dispatchEvent(new CustomEvent('change', { detail: what }));
  }

  async load() {
    await siteStyle.load();
    this.downloads = await readPref('downloads', {});
    this.progress = await readPref('progress', {});
    this.settings = { ...DEFAULT_SETTINGS, ...(await readPref('settings', {})) };
    try {
      const { data } = await Filesystem.readFile({ path: POSTS_FILE, directory: Directory.Data, encoding: Encoding.UTF8 });
      const cached = JSON.parse(data);
      this.setPosts(cached.posts, cached.fetchedAt);
      this.setSlides(cached.slides);
    } catch (e) {
      // 首次启动还没有目录缓存
    }
  }

  setPosts(rows, fetchedAt) {
    this.posts = new Map(rows.map((p) => [p.post_url, p]));
    this.postsFetchedAt = fetchedAt;
  }

  setSlides(rows) {
    this.slides = new Map((rows || []).map((s) => [s.post_url, s]));
  }

  async refreshPosts() {
    const [rows, slides] = await Promise.all([
      fetchAllPosts(),
      fetchAllSlides().catch(() => null), // slides 页面取不到时保留原有缓存
    ]);
    const fetchedAt = Date.now();
    this.setPosts(rows, fetchedAt);
    if (slides) this.setSlides(slides);
    await Filesystem.writeFile({
      path: POSTS_FILE, directory: Directory.Data, encoding: Encoding.UTF8, recursive: true,
      data: JSON.stringify({ fetchedAt, posts: rows, slides: [...this.slides.values()] }),
    });
    this.changed('posts');
  }

  post(postUrl) {
    return this.posts.get(postUrl) || this.slides.get(postUrl)
      || { post_url: postUrl, title: decodeURIComponent(postUrl.split('/').pop().replace(/\.html$/, '')).replace(/-/g, ' '), categories: [] };
  }

  /* ---------- 离线文章 ---------- */

  // 联网取文章；样式过期时顺带从同一个页面刷新站点样式，保证下载的文章离线也按原样渲染
  async fetchArticle(postUrl) {
    const doc = await fetchArticlePage(postUrl);
    if (siteStyle.stale) await siteStyle.refreshFrom(doc).catch(() => {});
    return articleHtml(doc);
  }

  isDownloaded(postUrl) {
    return !!this.downloads[postUrl];
  }

  isDownloading(postUrl) {
    return this.pending.has(postUrl);
  }

  async saveArticle(postUrl, html) {
    await Filesystem.writeFile({
      path: articleFile(postUrl), directory: Directory.Data, encoding: Encoding.UTF8, recursive: true, data: html,
    });
    this.downloads[postUrl] = { savedAt: Date.now(), bytes: new Blob([html]).size };
    await writePref('downloads', this.downloads);
    this.changed('downloads');
  }

  download(postUrl) {
    if (this.pending.has(postUrl)) return this.pending.get(postUrl);
    const job = this.fetchArticle(postUrl)
      .then((html) => this.saveArticle(postUrl, html))
      .finally(() => { this.pending.delete(postUrl); this.changed('downloads'); });
    this.pending.set(postUrl, job);
    this.changed('downloads');
    return job;
  }

  async readArticle(postUrl) {
    const { data } = await Filesystem.readFile({ path: articleFile(postUrl), directory: Directory.Data, encoding: Encoding.UTF8 });
    return data;
  }

  async removeDownload(postUrl) {
    delete this.downloads[postUrl];
    await writePref('downloads', this.downloads);
    await Filesystem.deleteFile({ path: articleFile(postUrl), directory: Directory.Data }).catch(() => {});
    this.changed('downloads');
  }

  async clearDownloads() {
    this.downloads = {};
    await writePref('downloads', this.downloads);
    await Filesystem.rmdir({ path: 'articles', directory: Directory.Data, recursive: true }).catch(() => {});
    this.changed('downloads');
  }

  downloadedBytes() {
    return Object.values(this.downloads).reduce((sum, d) => sum + (d.bytes || 0), 0);
  }

  /* ---------- 阅读进度 ---------- */

  setProgress(postUrl, position) {
    this.progress[postUrl] = { ...position, updatedAt: Date.now() };
    return writePref('progress', this.progress);
  }

  // 继续阅读：读过但没读完的，按最近打开排序
  inProgress() {
    return Object.entries(this.progress)
      .filter(([, p]) => p.percent > 0.02 && p.percent < 0.9)
      .sort((a, b) => b[1].updatedAt - a[1].updatedAt)
      .map(([postUrl]) => postUrl);
  }

  /* ---------- 设置 ---------- */

  updateSettings(patch) {
    this.settings = { ...this.settings, ...patch };
    this.changed('settings');
    return writePref('settings', this.settings);
  }
}

export const library = new Library();
