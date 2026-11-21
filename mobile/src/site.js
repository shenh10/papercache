// 站点访问：论文目录（Supabase posts_search）+ 文章正文（papercache.org 页面）
import { Capacitor, CapacitorHttp } from '@capacitor/core';
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

export async function fetchText(path) {
  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.get({ url: SITE + path, responseType: 'text' });
    if (res.status !== 200) throw new Error('HTTP ' + res.status);
    return res.data;
  }
  const res = await fetch('/__site' + path);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.text();
}

export async function fetchArticlePage(postUrl) {
  const html = await fetchText(canonicalPath(postUrl));
  return new DOMParser().parseFromString(html, 'text/html');
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

// 演示文稿合集：posts_search 里没有，从 /slides/ 页面解析条目（与论文同构，阅读器直接可读）
export async function fetchAllSlides() {
  const html = await fetchText('/slides/');
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const slides = [];
  for (const li of doc.querySelectorAll('li[data-post-url]')) {
    const post_url = li.getAttribute('data-post-url');
    if (!post_url || !post_url.startsWith('/slides/')) continue;
    const m = post_url.match(/^\/slides\/(.+)\/(\d{4})\/(\d{2})\/\d{2}\/[^/]+\.html$/);
    slides.push({
      post_url,
      title: li.querySelector('.post-card-title-modern')?.textContent.trim()
        || li.querySelector('a[data-post-title]')?.getAttribute('data-post-title') || '',
      excerpt: (li.querySelector('.post-card-excerpt-modern')?.textContent.trim() || '').slice(0, 160),
      categories: m ? m[1].split('/') : [],
      tag: li.querySelector('.post-card-tag-modern')?.textContent.trim() || '',
      published_date: li.querySelector('.post-meta-modern')?.textContent.trim() || (m ? `${m[2]}-${m[3]}` : ''),
    });
  }
  return slides;
}
