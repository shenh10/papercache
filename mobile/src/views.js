// 三个主页面：书架、发现、我的
import { Browser } from '@capacitor/browser';
import { library } from './library.js';
import { account } from './account.js';
import { paperRow, pageHead, escapeHtml, formatBytes, toast } from './ui.js';
import { updates, DOWNLOAD_URL } from './updates.js';
import { SITE } from './site.js';

class View {
  constructor(root) {
    this.root = root;
    this.render = this.render.bind(this);
  }

  mount() {
    library.addEventListener('change', this.render);
    account.addEventListener('change', this.render);
    updates.addEventListener('change', this.render);
    this.render();
  }

  unmount() {
    library.removeEventListener('change', this.render);
    account.removeEventListener('change', this.render);
    updates.removeEventListener('change', this.render);
  }
}

export class ShelfView extends View {
  render() {
    const reading = library.inProgress();
    const favorites = [...account.favorites.keys()];
    const downloadedOnly = Object.keys(library.downloads)
      .filter((u) => !account.isFavorite(u))
      .sort((a, b) => library.downloads[b].savedAt - library.downloads[a].savedAt);
    const missing = account.missingFavorites().length;

    const section = (title, extra, rows, empty) => `
      <section class="shelf-section">
        <div class="section-head"><h2>${title}</h2>${extra || ''}</div>
        ${rows.length ? rows.join('') : `<p class="empty-line">${empty}</p>`}
      </section>`;

    this.root.innerHTML = `
      ${pageHead('我的书架', '收藏、下载和读到一半的论文都在这里', `
        <div class="hero-stats">
          <div class="hero-stat"><b>${reading.length}</b><span>在读</span></div>
          <div class="hero-stat"><b>${favorites.length}</b><span>收藏</span></div>
          <div class="hero-stat"><b>${Object.keys(library.downloads).length}</b><span>已下载</span></div>
        </div>`)}
      ${reading.length ? section('继续阅读', '', reading.map((u) => {
        const label = library.progress[u].label;
        return paperRow(u, { resumeHint: label ? '读到 ' + label : '' });
      }), '') : ''}
      ${section('我的收藏',
        account.user && missing ? `<button class="link-btn" data-act="dl-favs">下载全部（${missing}）</button>` : '',
        favorites.map((u) => paperRow(u)),
        account.user ? '还没有收藏。读文章时点右上角 ☆ 收藏。' : '登录后同步网站上的收藏。去「我的」登录。')}
      ${section('已下载', downloadedOnly.length ? `<span class="muted">${downloadedOnly.length} 篇</span>` : '',
        downloadedOnly.map((u) => paperRow(u)), '没有收藏之外的下载。')}`;

    const btn = this.root.querySelector('[data-act="dl-favs"]');
    if (btn) btn.onclick = () => {
      toast(`开始下载 ${missing} 篇`);
      account.downloadMissingFavorites({ force: true }).then(() => toast('收藏已全部下载'));
    };
  }
}

export class DiscoverView extends View {
  constructor(root) {
    super(root);
    this.query = '';
    this.path = [];       // 分类路径，如 ['llm', 'algorithm']，逐级下钻
    this.src = 'papers';  // papers | slides
    this.limit = 40;
  }

  mount() {
    this.root.innerHTML = `
      ${pageHead('发现', '论文与演示文稿',
        '<form class="search-box"><input type="search" placeholder="搜索标题、摘要、分类…" enterkeyhint="search"><button class="search-go">搜索</button></form>')}
      <div class="seg"></div>
      <div class="latest"></div>
      <div class="crumbs"></div>
      <div class="chips"></div>
      <div class="list"></div>`;
    const input = this.root.querySelector('input');
    input.value = this.query;
    input.addEventListener('input', () => { this.query = input.value.trim().toLowerCase(); this.limit = 40; this.renderList(); });
    this.root.querySelector('.search-box').addEventListener('submit', (e) => { e.preventDefault(); input.blur(); });
    this.root.querySelector('.seg').addEventListener('click', (e) => {
      const b = e.target.closest('[data-src]');
      if (!b || b.dataset.src === this.src) return;
      this.src = b.dataset.src;
      this.path = [];
      this.limit = 40;
      this.render();
    });
    this.root.querySelector('.crumbs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-depth]');
      if (!b) return;
      this.path = this.path.slice(0, +b.dataset.depth);
      this.limit = 40;
      this.render();
    });
    this.root.querySelector('.chips').addEventListener('click', (e) => {
      const chip = e.target.closest('[data-cat]');
      if (!chip) return;
      this.path = [...this.path, chip.dataset.cat]; // 下钻一级
      this.limit = 40;
      this.render();
    });
    super.mount();
  }

  dataset() {
    return this.src === 'slides' ? [...library.slides.values()] : [...library.posts.values()];
  }

  render() {
    const papers = library.posts.size, slides = library.slides.size;
    this.root.querySelector('.seg').innerHTML =
      `<button class="${this.src === 'papers' ? 'on' : ''}" data-src="papers">论文 ${papers || ''}</button>` +
      `<button class="${this.src === 'slides' ? 'on' : ''}" data-src="slides">演示文稿 ${slides || ''}</button>`;

    // 首页状态（无搜索、无分类）显示最新动态；列表本身就是「最新添加」的顺序
    const latest = this.root.querySelector('.latest');
    if (this.src !== 'papers' || this.query || this.path.length || !papers) {
      latest.innerHTML = '';
    } else {
      const byAdded = [...library.posts.values()].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
      const byPublished = [...library.posts.values()].sort((a, b) => (b.published_date || '').localeCompare(a.published_date || ''));
      latest.innerHTML = `
        <section class="card"><div class="card-title">📥 最新添加</div>${byAdded.slice(0, 5).map((p) => latestRow(p, (p.created_at || '').slice(0, 7))).join('')}</section>
        <section class="card"><div class="card-title">📰 最新发表</div>${byPublished.slice(0, 5).map((p) => latestRow(p, (p.published_date || '').slice(0, 7))).join('')}</section>`;
    }

    const crumbs = this.root.querySelector('.crumbs');
    crumbs.innerHTML = this.path.length
      ? `<button data-depth="0">全部</button>` + this.path.map((c, i) =>
        `<span class="sep">›</span><button data-depth="${i + 1}">${escapeHtml(c)}</button>`).join('')
      : '';

    const counts = {};
    for (const p of this.dataset()) {
      const cats = p.categories || [];
      if (cats.length > this.path.length && cats.slice(0, this.path.length).join('/') === this.path.join('/')) {
        const c = cats[this.path.length];
        counts[c] = (counts[c] || 0) + 1;
      }
    }
    this.root.querySelector('.chips').innerHTML = Object.entries(counts).sort((a, b) => b[1] - a[1])
      .map(([c, n]) => `<button class="chip" data-cat="${escapeHtml(c)}">${escapeHtml(c)} ${n} ›</button>`)
      .join('');
    this.renderList();
  }

  renderList() {
    const list = this.root.querySelector('.list');
    const data = this.dataset();
    if (!data.length) {
      list.innerHTML = `<p class="empty-line">${navigator.onLine ? '正在加载目录…' : '离线状态，还没有缓存目录。'}</p>`;
      return;
    }
    const q = this.query;
    const matches = data.filter((p) =>
      (!this.path.length || (p.categories || []).slice(0, this.path.length).join('/') === this.path.join('/')) &&
      (!q || (p.title + ' ' + (p.excerpt || '') + ' ' + (p.categories || []).join(' ')).toLowerCase().includes(q)));
    list.innerHTML = `<p class="muted list-count">${matches.length} 篇${this.path.length ? ' · ' + escapeHtml(this.path.join(' / ')) : ''}</p>` +
      matches.slice(0, this.limit).map((p) => paperRow(p.post_url, { showExcerpt: true })).join('') +
      (matches.length > this.limit ? '<button class="btn more">加载更多</button>' : '');
    const more = list.querySelector('.more');
    if (more) more.onclick = () => { this.limit += 40; this.renderList(); };
  }
}

function latestRow(p, date) {
  const cat = (p.categories || []).slice(-1)[0];
  return `<a class="latest-row" href="#/read?u=${encodeURIComponent(p.post_url)}">
    <span class="latest-date">${date}</span>${cat ? `<span class="cat-pill">${escapeHtml(cat)}</span>` : ''}
    <span class="latest-title">${escapeHtml(p.title)}</span></a>`;
}

export class MeView extends View {
  render() {
    const s = library.settings;
    const user = account.user;
    const avatar = account.profile?.avatar_url || user?.user_metadata?.avatar_url;
    this.root.innerHTML = `
      ${pageHead('我的', user ? '收藏与 papercache.org 同步' : '登录后同步网站上的收藏')}
      <section class="card">
        ${user ? `
          <div class="account-line"><div class="account-id">${avatar ? `<img class="avatar" src="${escapeHtml(avatar)}" alt="">` : ''}<div><div class="muted">已登录</div><div>${escapeHtml(account.displayName())}</div>${user.email && account.displayName() !== user.email ? `<div class="muted small">${escapeHtml(user.email)}</div>` : ''}</div></div>
          <button class="btn ghost" data-act="logout">退出</button></div>
          <div class="muted">收藏 ${account.favorites.size} 篇，与 papercache.org 同步</div>` : `
          <form class="login-form">
            <input name="email" type="email" placeholder="邮箱" autocomplete="email" required>
            <input name="password" type="password" placeholder="密码" autocomplete="current-password" required>
            <button class="btn" type="submit">登录</button>
          </form>
          <button class="btn ghost full" data-act="github">用 GitHub 登录</button>
          <p class="muted">与网站同一个账号，登录后收藏自动同步。</p>`}
      </section>
      ${account.isAdmin ? `
      <section class="card">
        <div class="account-line"><div><div>网站管理后台</div><div class="muted">用户、收藏、点赞与访问统计</div></div>
        <button class="btn ghost" data-act="admin">打开</button></div>
      </section>` : ''}
      <section class="card">
        <div class="card-title">外观</div>
        <label class="switch-line"><span>深色模式（关灯）</span><input type="checkbox" data-set="theme" ${s.theme === 'dark' ? 'checked' : ''}></label>
      </section>
      <section class="card">
        <div class="card-title">下载</div>
        <label class="switch-line"><span>收藏后自动下载</span><input type="checkbox" data-set="autoDownloadFavorites" ${s.autoDownloadFavorites ? 'checked' : ''}></label>
        <label class="switch-line"><span>允许用移动网络自动下载</span><input type="checkbox" data-set="cellularDownload" ${s.cellularDownload ? 'checked' : ''}></label>
      </section>
      <section class="card">
        <div class="account-line"><div><div>离线文章</div><div class="muted">${Object.keys(library.downloads).length} 篇 · ${formatBytes(library.downloadedBytes())}</div></div>
        <button class="btn ghost danger" data-act="clear">清空</button></div>
      </section>
      <section class="card">
        <div class="account-line"><div><div>版本</div><div class="muted">${updates.current ? `${escapeHtml(updates.current.version)}（build ${updates.current.build}）` : '开发版'}</div></div>
        ${updates.available ? `<a class="btn" href="${DOWNLOAD_URL}" data-external>更新到 build ${updates.latest.build}</a>` : '<span class="muted">已是最新</span>'}</div>
      </section>
      <p class="muted center">PaperCache · <a href="https://www.papercache.org" data-external>papercache.org</a></p>`;

    this.root.querySelectorAll('[data-set]').forEach((box) => {
      box.onchange = () => library.updateSettings(box.dataset.set === 'theme'
        ? { theme: box.checked ? 'dark' : 'light' }
        : { [box.dataset.set]: box.checked });
    });
    const on = (act, fn) => { const b = this.root.querySelector(`[data-act="${act}"]`); if (b) b.onclick = fn; };
    on('logout', () => account.signOut());
    on('github', () => account.signInWithGitHub().catch((e) => toast(e.message)));
    on('admin', () => Browser.open({ url: SITE + '/admin/' }));
    on('clear', () => { if (confirm('删除本机所有离线文章？')) library.clearDownloads(); });
    const form = this.root.querySelector('.login-form');
    if (form) form.onsubmit = (e) => {
      e.preventDefault();
      account.signInWithPassword(form.email.value, form.password.value)
        .then(() => toast('已登录'))
        .catch((err) => toast('登录失败：' + err.message));
    };
  }
}
