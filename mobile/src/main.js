import './style.css';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Network } from '@capacitor/network';
import { library } from './library.js';
import { account } from './account.js';
import { Reader } from './reader.js';
import { ShelfView, DiscoverView, MeView } from './views.js';
import { navigate, toast } from './ui.js';
import { updates } from './updates.js';

const CATALOG_MAX_AGE = 30 * 60 * 1000;
const root = document.getElementById('app');
const tabs = { shelf: ShelfView, discover: DiscoverView, me: MeView };
const tabScroll = {};
let current = null;
let currentKey = '';

history.scrollRestoration = 'manual';

function route() {
  const [path, query] = location.hash.replace(/^#/, '').split('?');
  const params = new URLSearchParams(query || '');
  if (path === '/read' && params.get('u')) return { key: 'read:' + params.get('u'), make: () => new Reader(root, params.get('u')) };
  const tab = path === '/discover' ? 'discover' : path === '/me' ? 'me' : 'shelf';
  return { key: tab, tab, make: () => new tabs[tab](root) };
}

function render() {
  const next = route();
  if (next.key === currentKey) return;
  if (current) {
    if (!currentKey.startsWith('read:')) tabScroll[currentKey] = window.scrollY;
    current.unmount();
  }
  currentKey = next.key;
  current = next.make();
  document.querySelectorAll('#tabbar a').forEach((a) => a.classList.toggle('active', a.dataset.tab === next.tab));
  current.mount();
  window.scrollTo(0, next.tab ? tabScroll[next.key] || 0 : 0);
}

async function refreshCatalog(force = false) {
  if (!force && Date.now() - library.postsFetchedAt < CATALOG_MAX_AGE) return;
  try {
    await library.refreshPosts();
  } catch (err) {
    if (!library.posts.size) toast('论文目录加载失败，请检查网络');
  }
}

document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-external]');
  if (a) { e.preventDefault(); Browser.open({ url: a.href }); }
});

App.addListener('backButton', () => {
  if (currentKey === 'shelf') App.exitApp();
  else if (history.length > 1) history.back();
  else navigate('#/');
});

// 回到前台：刷新目录、同步收藏、补下载
App.addListener('resume', () => {
  refreshCatalog();
  account.syncFavorites().catch(() => {});
});

Network.addListener('networkStatusChange', (status) => {
  if (status.connected) account.downloadMissingFavorites().catch(() => {});
});

window.addEventListener('hashchange', render);

(async function start() {
  await library.load();
  await account.init();
  render();
  refreshCatalog();
  updates.check()
    .then(() => { if (updates.available) toast('有新版本可用', { action: '去更新', onAction: () => navigate('#/me') }); })
    .catch(() => {});
})();
