// 三个主页面：书架、发现、我的
import { library } from './library.js';
import { account } from './account.js';
import { paperRow, escapeHtml, formatBytes, toast } from './ui.js';

class View {
  constructor(root) {
    this.root = root;
    this.render = this.render.bind(this);
  }

  mount() {
    library.addEventListener('change', this.render);
    account.addEventListener('change', this.render);
    this.render();
  }

  unmount() {
    library.removeEventListener('change', this.render);
    account.removeEventListener('change', this.render);
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
      <header class="page-head"><h1>书架</h1></header>
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
    this.category = '';
    this.limit = 40;
  }

  mount() {
    this.root.innerHTML = `
      <header class="page-head"><h1>发现</h1></header>
      <div class="search-box"><input type="search" placeholder="搜索标题、摘要、分类" enterkeyhint="search"></div>
      <div class="chips"></div>
      <div class="list"></div>`;
    const input = this.root.querySelector('input');
    input.value = this.query;
    input.addEventListener('input', () => { this.query = input.value.trim().toLowerCase(); this.limit = 40; this.renderList(); });
    this.root.querySelector('.chips').addEventListener('click', (e) => {
      const chip = e.target.closest('[data-cat]');
      if (!chip) return;
      this.category = this.category === chip.dataset.cat ? '' : chip.dataset.cat;
      this.limit = 40;
      this.render();
    });
    super.mount();
  }

  render() {
    const counts = {};
    for (const p of library.posts.values()) {
      const c = (p.categories || [])[0];
      if (c) counts[c] = (counts[c] || 0) + 1;
    }
    this.root.querySelector('.chips').innerHTML = Object.entries(counts).sort((a, b) => b[1] - a[1])
      .map(([c, n]) => `<button class="chip ${c === this.category ? 'on' : ''}" data-cat="${escapeHtml(c)}">${escapeHtml(c)} ${n}</button>`)
      .join('');
    this.renderList();
  }

  renderList() {
    const list = this.root.querySelector('.list');
    if (!library.posts.size) {
      list.innerHTML = `<p class="empty-line">${navigator.onLine ? '正在加载论文目录…' : '离线状态，还没有缓存论文目录。'}</p>`;
      return;
    }
    const q = this.query;
    const matches = [...library.posts.values()].filter((p) =>
      (!this.category || (p.categories || [])[0] === this.category) &&
      (!q || (p.title + ' ' + (p.excerpt || '') + ' ' + (p.categories || []).join(' ')).toLowerCase().includes(q)));
    list.innerHTML = `<p class="muted list-count">${matches.length} 篇</p>` +
      matches.slice(0, this.limit).map((p) => paperRow(p.post_url, { showExcerpt: true })).join('') +
      (matches.length > this.limit ? '<button class="btn more">加载更多</button>' : '');
    const more = list.querySelector('.more');
    if (more) more.onclick = () => { this.limit += 40; this.renderList(); };
  }
}

export class MeView extends View {
  render() {
    const s = library.settings;
    const user = account.user;
    this.root.innerHTML = `
      <header class="page-head"><h1>我的</h1></header>
      <section class="card">
        ${user ? `
          <div class="account-line"><div><div class="muted">已登录</div><div>${escapeHtml(user.email || user.user_metadata?.user_name || '')}</div></div>
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
      <section class="card">
        <label class="switch-line"><span>收藏后自动下载</span><input type="checkbox" data-set="autoDownloadFavorites" ${s.autoDownloadFavorites ? 'checked' : ''}></label>
        <label class="switch-line"><span>允许用移动网络自动下载</span><input type="checkbox" data-set="cellularDownload" ${s.cellularDownload ? 'checked' : ''}></label>
      </section>
      <section class="card">
        <div class="account-line"><div><div>离线文章</div><div class="muted">${Object.keys(library.downloads).length} 篇 · ${formatBytes(library.downloadedBytes())}</div></div>
        <button class="btn ghost danger" data-act="clear">清空</button></div>
      </section>
      <p class="muted center">PaperCache · <a href="https://www.papercache.org" data-external>papercache.org</a></p>`;

    this.root.querySelectorAll('[data-set]').forEach((box) => {
      box.onchange = () => library.updateSettings({ [box.dataset.set]: box.checked });
    });
    const on = (act, fn) => { const b = this.root.querySelector(`[data-act="${act}"]`); if (b) b.onclick = fn; };
    on('logout', () => account.signOut());
    on('github', () => account.signInWithGitHub().catch((e) => toast(e.message)));
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
