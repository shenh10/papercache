// 各页面共用的小部件：提示条、论文条目、格式化
import { library } from './library.js';
import { account } from './account.js';

export function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function navigate(hash) {
  location.hash = hash;
}

export function formatBytes(n) {
  if (!n) return '0 KB';
  if (n < 1024 * 1024) return Math.round(n / 1024) + ' KB';
  return (n / 1024 / 1024).toFixed(1) + ' MB';
}

let toastTimer = null;
export function toast(text, { action, onAction } = {}) {
  const el = document.getElementById('toast');
  el.innerHTML = `<span>${escapeHtml(text)}</span>${action ? `<button>${escapeHtml(action)}</button>` : ''}`;
  if (action) el.querySelector('button').onclick = () => { el.classList.remove('show'); onAction(); };
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), action ? 4500 : 2200);
}

// 一行论文：标题、日期分类、状态徽标（进度 / 已下载 / 收藏已读）
export function paperRow(postUrl, { showExcerpt = false, resumeHint = '' } = {}) {
  const p = library.post(postUrl);
  const progress = library.progress[postUrl];
  const fav = account.favorites.get(postUrl);
  const badges = [];
  if (progress && progress.percent >= 0.02) {
    badges.push(progress.percent >= 0.9 ? '<span class="badge done">读完</span>'
      : `<span class="badge">${Math.round(progress.percent * 100)}%</span>`);
  }
  if (library.isDownloading(postUrl)) badges.push('<span class="badge">下载中</span>');
  else if (library.isDownloaded(postUrl)) badges.push('<span class="badge ok">已下载</span>');
  if (fav) badges.push(fav.is_read ? '<span class="badge">★ 已读</span>' : '<span class="badge fav">★</span>');
  const meta = [p.published_date ? p.published_date.slice(0, 7) : '', (p.categories || []).join(' / '), p.tag === 'blog' ? 'blog' : '']
    .filter(Boolean).join(' · ');
  return `<a class="paper-row" href="#/read?u=${encodeURIComponent(postUrl)}">
    <div class="paper-title">${escapeHtml(p.title)}</div>
    ${showExcerpt && p.excerpt ? `<div class="paper-excerpt">${escapeHtml(p.excerpt)}</div>` : ''}
    <div class="paper-meta"><span>${escapeHtml(meta)}</span>${badges.join('')}</div>
    ${resumeHint ? `<div class="resume-hint">${escapeHtml(resumeHint)}</div>` : ''}
  </a>`;
}
