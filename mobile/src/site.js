// 站点访问：论文目录（Supabase posts_search）+ 文章正文（papercache.org 页面）
import { Capacitor } from '@capacitor/core';
import { supabase } from './supabase.js';

export const SITE = 'https://www.papercache.org';

// 收藏表、搜索表里的 post_url 都是带 .html 的站内路径；页面的规范地址是去掉 .html 的形式
export function canonicalPath(postUrl) {
  return postUrl.replace(/\.html$/, '');
}

export function normalizePostUrl(href) {
  const u = new URL(href, SITE);
  if (u.origin !== SITE || !(u.pathname.startsWith('/papers/') || u.pathname.startsWith('/slides/'))) return null;
  return u.pathname.endsWith('.html') ? u.pathname : u.pathname + '.html';
}

// 页面走 WebView 自己的网络栈（与网站、Supabase 同一条路）；Cloudflare Pages 默认带 CORS 头
export async function fetchText(path) {
  const res = await fetch((Capacitor.isNativePlatform() ? SITE : '/__site') + path);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.text();
}

export async function fetchArticlePage(postUrl) {
  // slides 已私有化：HTML 在 Supabase 私有桶里，登录管理员的会话由 RLS 校验
  if (postUrl.startsWith('/slides/')) {
    const path = await slideObjectKey(postUrl);
    const { data, error } = await supabase.storage.from('slides').download(path);
    if (error) throw new Error(error.message || '下载失败');
    return new DOMParser().parseFromString(await data.text(), 'text/html');
  }
  const html = await fetchText(canonicalPath(postUrl));
  return new DOMParser().parseFromString(html, 'text/html');
}

// 对象键 = sha256(post_url) 前 16 位 + .html。Supabase Storage 对中文文件名有编码 bug，
// 与 scripts/sync_slides_to_supabase.py 的 object_key() 保持一致
export async function slideObjectKey(postUrl) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(postUrl));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16) + '.html';
}

// 文章页 → 文章头 + 正文，保留网站原有的结构和 class，样式由 sitestyle 按原样套上。
// 图片是 base64 内联的，这段 HTML 本身就是完整的一篇
export function articleHtml(doc) {
  const content = doc.querySelector('.post-content');
  if (!content) throw new Error('页面里没有找到正文');
  content.querySelectorAll('script, style, iframe').forEach((n) => n.remove());
  const header = doc.querySelector('.post-header');
  if (header) {
    // 点赞、收藏、分享、离线按钮由 App 工具栏提供
    header.querySelectorAll('.post-actions-inline, .post-share-inline, .post-meta-separator, .offline-save-btn, script')
      .forEach((n) => n.remove());
  }
  tidyArticle(content, header);
  return (header ? header.outerHTML : '') + `<div class="post-content e-content">${content.innerHTML}</div>`;
}

// 网站模板的正文开头会重复一遍标题，论文信息（发表时间/原文/作者）是裸文本段落。
// 这里去掉重复标题，把信息段落包成 .paper-info，由 App 样式渲染成卡片
function tidyArticle(content, header) {
  const container = content.querySelector('.paper-content > .container') || content.querySelector('.paper-content');
  if (!container) return;
  const title = header?.querySelector('.post-title')?.textContent.trim();
  const h1 = container.querySelector('h1');
  if (title && h1 && h1.textContent.trim() === title) h1.remove();

  const infoLabel = /^(发表时间|原文|来源|链接|编号|作者|机构|arXiv)/;
  const info = [];
  for (const p of [...container.children]) {
    const label = p.matches('p') && p.querySelector('strong')?.textContent.trim();
    if (label && infoLabel.test(label)) info.push(p);
    else break;
  }
  if (info.length) {
    const card = content.ownerDocument.createElement('div');
    card.className = 'paper-info';
    container.insertBefore(card, info[0]);
    info.forEach((p) => card.appendChild(p));
  }
}

const POST_FIELDS = 'post_url,title,excerpt,categories,tag,published_date,created_at';

export async function fetchAllPosts() {
  const pageSize = 500;
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('posts_search')
      .select(POST_FIELDS)
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...data.map((r) => ({ ...r, excerpt: (r.excerpt || '').slice(0, 160) })));
      if (data.length < pageSize) return rows;
    }
}

// 演示文稿合集：Supabase 私有表 slides_search（RLS 仅管理员）。
// 非管理员/未登录会拿到空列表——入口本来就不显示，这里双重保险。
export async function fetchAllSlides() {
  const { data, error } = await supabase.from('slides_search')
    .select('post_url,title,excerpt,categories,tag,published_date')
    .order('published_date', { ascending: false });
  if (error) return []; // 权限不足（RLS）或表未建，静默返回空
  return data || [];
}
