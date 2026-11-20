// 阅读页：优先读本机文件，否则联网取正文；排完公式后恢复上次位置，滚动时记录进度
import { Browser } from '@capacitor/browser';
import { library } from './library.js';
import { account } from './account.js';
import { fetchArticle, normalizePostUrl, SITE } from './site.js';
import { toast, escapeHtml, navigate } from './ui.js';

const FONT_SCALES = [0.9, 1, 1.12, 1.25];
const HEADINGS = 'h1, h2, h3, h4';

function typeset(el) {
  const ready = () => window.MathJax && window.MathJax.typesetPromise;
  return new Promise((resolve) => {
    const start = Date.now();
    (function wait() {
      if (ready()) return window.MathJax.startup.promise.then(() => window.MathJax.typesetPromise([el])).then(resolve, resolve);
      if (Date.now() - start > 10000) return resolve();
      setTimeout(wait, 50);
    })();
  });
}

export class Reader {
  constructor(root, postUrl) {
    this.root = root;
    this.postUrl = postUrl;
    this.post = library.post(postUrl);
    this.saveTimer = null;
    this.onScroll = this.onScroll.bind(this);
    this.onChange = () => this.renderToolbar();
  }

  mount() {
    document.body.classList.add('reading');
    this.root.innerHTML = `
      <header class="reader-bar">
        <button class="icon-btn" data-act="back" aria-label="返回">‹</button>
        <div class="reader-bar-title">${escapeHtml(this.post.title)}</div>
        <button class="icon-btn" data-act="font" aria-label="字号">Aa</button>
        <button class="icon-btn" data-act="fav" aria-label="收藏"></button>
        <button class="icon-btn" data-act="dl" aria-label="下载"></button>
        <div class="reader-progress"><div class="reader-progress-fill"></div></div>
      </header>
      <article class="reader-content"><div class="loading">加载中…</div></article>`;
    this.content = this.root.querySelector('.reader-content');
    this.root.querySelector('.reader-bar').addEventListener('click', (e) => this.onToolbar(e));
    this.content.addEventListener('click', (e) => this.onLink(e));
    library.addEventListener('change', this.onChange);
    account.addEventListener('change', this.onChange);
    this.applyFont();
    this.renderToolbar();
    this.load();
  }

  unmount() {
    document.body.classList.remove('reading');
    window.removeEventListener('scroll', this.onScroll);
    library.removeEventListener('change', this.onChange);
    account.removeEventListener('change', this.onChange);
    this.flushProgress();
  }

  async load() {
    let html;
    try {
      html = library.isDownloaded(this.postUrl)
        ? await library.readArticle(this.postUrl)
        : await fetchArticle(this.postUrl);
    } catch (err) {
      this.content.innerHTML = `<div class="empty">
        <p>${err instanceof TypeError || !navigator.onLine ? '网络不可用，这篇还没有下载到本机。' : '加载失败：' + escapeHtml(err.message)}</p>
        <button class="btn" data-retry>重试</button></div>`;
      this.content.querySelector('[data-retry]').onclick = () => this.load();
      return;
    }
    this.content.innerHTML = html;
    if (!library.isDownloaded(this.postUrl) && account.isFavorite(this.postUrl) && await account.mayAutoDownload()) {
      library.saveArticle(this.postUrl, html).catch(() => {});
    }
    await typeset(this.content);
    this.restorePosition();
    window.addEventListener('scroll', this.onScroll, { passive: true });
  }

  /* ---------- 位置：最近的章节标题 + 在该节里的比例，换设备、换字号都能对上 ---------- */

  headings() {
    return [...this.content.querySelectorAll(HEADINGS)];
  }

  sectionBounds(i, list) {
    const top = i < 0 ? this.content.offsetTop : list[i].getBoundingClientRect().top + window.scrollY;
    const next = list[i + 1];
    const bottom = next ? next.getBoundingClientRect().top + window.scrollY : this.content.offsetTop + this.content.offsetHeight;
    return { top, bottom };
  }

  currentPosition() {
    const list = this.headings();
    const y = window.scrollY + 72;
    let i = -1;
    list.forEach((h, idx) => { if (h.getBoundingClientRect().top + window.scrollY <= y) i = idx; });
    const { top, bottom } = this.sectionBounds(i, list);
    const within = bottom > top ? Math.min(1, Math.max(0, (y - top) / (bottom - top))) : 0;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const percent = max > 0 ? Math.min(1, window.scrollY / max) : 1;
    const label = i >= 0 ? list[i].textContent.trim().slice(0, 40) : '';
    return { heading: i, within, percent, label };
  }

  restorePosition() {
    const saved = library.progress[this.postUrl];
    if (!saved || saved.percent < 0.02) return;
    const list = this.headings();
    const i = Math.min(saved.heading, list.length - 1);
    const { top, bottom } = this.sectionBounds(i, list);
    window.scrollTo(0, Math.max(0, top + saved.within * (bottom - top) - 72));
    this.updateProgressBar(saved.percent);
    toast(`已回到上次位置${saved.label ? ' · ' + saved.label : ''}`, { action: '从头读', onAction: () => window.scrollTo(0, 0) });
  }

  onScroll() {
    const pos = this.currentPosition();
    this.updateProgressBar(pos.percent);
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.flushProgress(), 600);
  }

  flushProgress() {
    clearTimeout(this.saveTimer);
    if (!this.content || !this.content.querySelector(HEADINGS + ', p')) return;
    const pos = this.currentPosition();
    library.setProgress(this.postUrl, pos);
    if (pos.percent >= 0.9) account.markRead(this.postUrl);
  }

  updateProgressBar(percent) {
    const fill = this.root.querySelector('.reader-progress-fill');
    if (fill) fill.style.width = Math.round(percent * 100) + '%';
  }

  /* ---------- 工具栏 ---------- */

  renderToolbar() {
    const fav = this.root.querySelector('[data-act="fav"]');
    const dl = this.root.querySelector('[data-act="dl"]');
    if (!fav) return;
    fav.textContent = account.isFavorite(this.postUrl) ? '★' : '☆';
    fav.classList.toggle('on', account.isFavorite(this.postUrl));
    dl.textContent = library.isDownloading(this.postUrl) ? '…' : library.isDownloaded(this.postUrl) ? '✓' : '⬇';
    dl.classList.toggle('on', library.isDownloaded(this.postUrl));
  }

  applyFont() {
    this.content.style.setProperty('--reader-scale', library.settings.fontScale);
  }

  async onToolbar(event) {
    const btn = event.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    try {
      if (act === 'back') {
        history.length > 1 ? history.back() : navigate('#/');
      } else if (act === 'font') {
        const i = FONT_SCALES.indexOf(library.settings.fontScale);
        await library.updateSettings({ fontScale: FONT_SCALES[(i + 1) % FONT_SCALES.length] });
        this.applyFont();
      } else if (act === 'fav') {
        if (account.isFavorite(this.postUrl)) {
          await account.unfavorite(this.postUrl);
          toast('已取消收藏', library.isDownloaded(this.postUrl)
            ? { action: '同时删除下载', onAction: () => library.removeDownload(this.postUrl) } : {});
        } else {
          await account.favorite(this.postUrl);
          toast('已收藏');
        }
      } else if (act === 'dl') {
        if (library.isDownloaded(this.postUrl)) {
          if (confirm('删除这篇的本机副本？')) await library.removeDownload(this.postUrl);
        } else {
          await library.download(this.postUrl);
          if (account.user && !account.isFavorite(this.postUrl)) await account.favorite(this.postUrl);
          toast('已下载，断网也能读');
        }
      }
    } catch (err) {
      toast(err.message || String(err));
    }
  }

  onLink(event) {
    const a = event.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (href.startsWith('#')) return;
    event.preventDefault();
    const postUrl = normalizePostUrl(href);
    if (postUrl) navigate('#/read?u=' + encodeURIComponent(postUrl));
    else Browser.open({ url: new URL(href, SITE).href });
  }
}
