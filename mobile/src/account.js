// 账号与收藏：与网站共用 Supabase 的 auth 和 favorites 表，收藏和离线下载在这里联动
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';
import { Preferences } from '@capacitor/preferences';
import { supabase } from './supabase.js';
import { library } from './library.js';

const OAUTH_REDIRECT = 'org.papercache.app://auth-callback';
const FAVORITES_CACHE = 'favorites';

class Account extends EventTarget {
  constructor() {
    super();
    this.user = null;
    this.profile = null; // 网站 profiles 表：username / full_name / avatar_url
    this.isAdmin = false;
    this.favorites = new Map(); // post_url → { is_read, created_at }
  }

  changed(what) {
    this.dispatchEvent(new CustomEvent('change', { detail: what }));
  }

  async init() {
    const { value } = await Preferences.get({ key: FAVORITES_CACHE });
    if (value) this.favorites = new Map(JSON.parse(value));

    const { data } = await supabase.auth.getSession();
    this.user = data.session ? data.session.user : null;
    supabase.auth.onAuthStateChange((event, session) => {
      const was = this.user && this.user.id;
      this.user = session ? session.user : null;
      if ((this.user && this.user.id) !== was) {
        this.changed('user');
        if (this.user) { this.syncFavorites(); this.syncProfile(); } else { this.setFavorites(new Map()); this.profile = null; this.isAdmin = false; this.changed('profile'); }
      }
    });

    // GitHub 登录走系统浏览器，回跳 org.papercache.app://auth-callback#access_token=...
    // （授权期间 App 若被系统回收，deep link 会冷启动 App，事件收不到，用 launch url 兜底）
    App.addListener('appUrlOpen', async ({ url }) => this.handleAuthUrl(url));
    const launch = await App.getLaunchUrl().catch(() => null);
    if (launch && launch.url) this.handleAuthUrl(launch.url);

    if (this.user) { this.syncFavorites(); this.syncProfile(); }
  }

  async signInWithPassword(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async signInWithGitHub() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: OAUTH_REDIRECT, skipBrowserRedirect: true, scopes: 'read:user user:email' },
    });
    if (error) throw error;
    if (Capacitor.isNativePlatform()) await Browser.open({ url: data.url });
    else window.location.href = data.url;
  }

  async handleAuthUrl(url) {
    if (!url.startsWith(OAUTH_REDIRECT) || url === this.lastAuthUrl) return;
    this.lastAuthUrl = url;
    Browser.close().catch(() => {});
    const u = new URL(url);
    const hash = new URLSearchParams(u.hash.slice(1));
    const error = u.searchParams.get('error') || hash.get('error');
    if (error) {
      this.dispatchEvent(new CustomEvent('autherror', { detail: '登录失败：' + (u.searchParams.get('error_description') || hash.get('error_description') || error) }));
      return;
    }
    try {
      const code = u.searchParams.get('code'); // PKCE 流：回跳带 ?code=
      if (code) { await supabase.auth.exchangeCodeForSession(code); return; }
      const access_token = hash.get('access_token'); // implicit 流：回跳带 #access_token=
      const refresh_token = hash.get('refresh_token');
      if (access_token && refresh_token) await supabase.auth.setSession({ access_token, refresh_token });
    } catch (e) {
      this.dispatchEvent(new CustomEvent('autherror', { detail: '登录失败：' + e.message }));
    }
  }

  async signOut() {
    await supabase.auth.signOut();
  }

  /* ---------- 资料 / 管理员（与网站 profiles 表同步） ---------- */

  displayName() {
    return this.profile?.full_name || this.profile?.username
      || this.user?.user_metadata?.full_name || this.user?.user_metadata?.user_name
      || this.user?.email || '';
  }

  async syncProfile() {
    if (!this.user) return;
    try {
      const { data } = await supabase.from('profiles')
        .select('username, full_name, avatar_url')
        .eq('id', this.user.id)
        .maybeSingle();
      this.profile = data || null;
      const { data: admin } = await supabase.rpc('check_user_is_admin', { p_user_id: this.user.id });
      this.isAdmin = !!admin;
    } catch {
      this.profile = null;
      this.isAdmin = false;
    }
    this.changed('profile');
  }

  /* ---------- 收藏 ---------- */

  isFavorite(postUrl) {
    return this.favorites.has(postUrl);
  }

  setFavorites(map) {
    this.favorites = map;
    Preferences.set({ key: FAVORITES_CACHE, value: JSON.stringify([...map]) });
    this.changed('favorites');
  }

  async syncFavorites() {
    if (!this.user) return;
    const { data, error } = await supabase
      .from('favorites')
      .select('post_url, is_read, created_at')
      .eq('user_id', this.user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    this.setFavorites(new Map(data.map((f) => [f.post_url, { is_read: !!f.is_read, created_at: f.created_at }])));
    this.downloadMissingFavorites();
  }

  async favorite(postUrl) {
    if (!this.user) throw new Error('请先在「我的」里登录');
    const { error } = await supabase.from('favorites').insert({ user_id: this.user.id, post_url: postUrl });
    if (error && error.code !== '23505') throw error;
    const next = new Map(this.favorites);
    next.set(postUrl, { is_read: false, created_at: new Date().toISOString() });
    this.setFavorites(next);
    if (await this.mayAutoDownload()) library.download(postUrl).catch(() => {});
  }

  async unfavorite(postUrl) {
    if (!this.user) return;
    const { error } = await supabase.from('favorites').delete().eq('user_id', this.user.id).eq('post_url', postUrl);
    if (error) throw error;
    const next = new Map(this.favorites);
    next.delete(postUrl);
    this.setFavorites(next);
  }

  async markRead(postUrl) {
    const fav = this.favorites.get(postUrl);
    if (!this.user || !fav || fav.is_read) return;
    const { error } = await supabase.from('favorites')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', this.user.id).eq('post_url', postUrl);
    if (error) return;
    const next = new Map(this.favorites);
    next.set(postUrl, { ...fav, is_read: true });
    this.setFavorites(next);
  }

  /* ---------- 收藏 → 自动下载 ---------- */

  async mayAutoDownload() {
    if (!library.settings.autoDownloadFavorites) return false;
    const status = await Network.getStatus();
    if (!status.connected) return false;
    return status.connectionType !== 'cellular' || library.settings.cellularDownload;
  }

  missingFavorites() {
    return [...this.favorites.keys()].filter((u) => !library.isDownloaded(u));
  }

  async downloadMissingFavorites({ force = false } = {}) {
    if (!force && !(await this.mayAutoDownload())) return;
    for (const postUrl of this.missingFavorites()) {
      await library.download(postUrl).catch(() => {});
    }
  }
}

export const account = new Account();
