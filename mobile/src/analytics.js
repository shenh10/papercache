// 活动上报：与网站共用 user_activity_logs 表——App 的访问由此计入后台 DAU 和热门页面。
// 未登录按匿名 session（每台设备一个持久 ID）去重，登录后按 user_id 去重，与网站口径一致
import { Preferences } from '@capacitor/preferences';
import { supabase } from './supabase.js';

let sessionId = null;
let lastOpenAt = 0;

async function getSessionId() {
  if (sessionId) return sessionId;
  const { value } = await Preferences.get({ key: 'analytics-session' });
  sessionId = value || crypto.randomUUID();
  if (!value) await Preferences.set({ key: 'analytics-session', value: sessionId });
  return sessionId;
}

async function log(activity) {
  try {
    const { data } = await supabase.auth.getSession();
    await supabase.from('user_activity_logs').insert({
      session_id: await getSessionId(),
      user_id: data?.session?.user?.id || null,
      user_agent: 'PaperCache-Android',
      ...activity,
    });
  } catch { /* 统计失败不影响使用 */ }
}

// 启动/回到前台时上报。DAU 按日去重，30 分钟内的重复 resume 不记，避免刷表
export async function appOpen() {
  if (Date.now() - lastOpenAt < 30 * 60 * 1000) return;
  lastOpenAt = Date.now();
  await log({ activity_type: 'app_open' });
}

// 打开一篇文章（page_path 用站内 post_url，后台「热门页面」直接可用）
export function pageView(postUrl, title) {
  return log({ activity_type: 'page_view', page_path: postUrl, page_title: title });
}
