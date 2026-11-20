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
  if (u.origin !== SITE || !u.pathname.startsWith('/papers/')) return null;
  return u.pathname.endsWith('.html') ? u.pathname : u.pathname + '.html';
}

async function fetchText(path) {
  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.get({ url: SITE + path, responseType: 'text' });
    if (res.status !== 200) throw new Error('HTTP ' + res.status);
    return res.data;
  }
  const res = await fetch('/__site' + path);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.text();
}

// 文章页 → 正文 HTML。图片是 base64 内联的，正文本身就是完整的一篇
export async function fetchArticle(postUrl) {
  const html = await fetchText(canonicalPath(postUrl));
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const content = doc.querySelector('.post-content');
  if (!content) throw new Error('页面里没有找到正文');
  content.querySelectorAll('script, style, iframe').forEach((n) => n.remove());
  return content.innerHTML;
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
