/**
 * 用户活动分析服务
 * 用于追踪用户行为并记录到 Supabase
 */

(function() {
  'use strict';

  // 获取或创建会话ID
  function getSessionId() {
    let sessionId = sessionStorage.getItem('pc_session_id');
    if (!sessionId) {
      sessionId = crypto.randomUUID ? crypto.randomUUID() : generateUUID();
      sessionStorage.setItem('pc_session_id', sessionId);
    }
    return sessionId;
  }

  // 生成UUID（兼容旧浏览器）
  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // 获取当前用户ID
  function getCurrentUserId() {
    if (window.SimpleAuth && window.SimpleAuth.getCurrentUser) {
      const user = window.SimpleAuth.getCurrentUser();
      return user ? user.id : null;
    }
    return null;
  }

  // 获取客户端信息
  function getClientInfo() {
    return {
      screen_width: window.screen?.width || null,
      screen_height: window.screen?.height || null,
      viewport_width: window.innerWidth || null,
      viewport_height: window.innerHeight || null,
      language: navigator.language || null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null
    };
  }

  // 记录活动（批量处理，提高性能）
  let activityQueue = [];
  let flushTimer = null;
  const FLUSH_INTERVAL = 5000; // 5秒批量提交一次
  const BATCH_SIZE = 10; // 每批最多10条

  function logActivity(activityData) {
    activityQueue.push({
      ...activityData,
      timestamp: new Date().toISOString()
    });

    // 如果队列满了，立即刷新
    if (activityQueue.length >= BATCH_SIZE) {
      flushActivities();
    } else {
      // 否则设置定时器
      if (!flushTimer) {
        flushTimer = setTimeout(flushActivities, FLUSH_INTERVAL);
      }
    }
  }

  async function flushActivities() {
    if (activityQueue.length === 0) return;

    const activities = activityQueue.splice(0, BATCH_SIZE);
    flushTimer = null;

    // 如果队列还有数据，继续设置定时器
    if (activityQueue.length > 0) {
      flushTimer = setTimeout(flushActivities, FLUSH_INTERVAL);
    }

    // 获取 Supabase 客户端
    let supabase = null;
    if (window.getSupabaseClient) {
      supabase = window.getSupabaseClient();
    }

    if (!supabase) {
      console.warn('[Analytics] Supabase client not available');
      return;
    }

    try {
      // 批量插入活动记录
      const sessionId = getSessionId();
      const userId = getCurrentUserId();
      const clientInfo = getClientInfo();

      const records = activities.map(activity => ({
        session_id: sessionId,
        user_id: userId,
        activity_type: activity.type,
        page_path: activity.page_path || window.location.pathname,
        page_title: activity.page_title || document.title,
        search_query: activity.search_query || null,
        target_url: activity.target_url || null,
        referrer: activity.referrer || document.referrer || null,
        metadata: {
          ...clientInfo,
          ...(activity.metadata || {})
        }
      }));

      const { error } = await supabase
        .from('user_activity_logs')
        .insert(records);

      if (error) {
        console.error('[Analytics] Failed to log activities:', error);
      }
    } catch (error) {
      console.error('[Analytics] Error flushing activities:', error);
    }
  }

  // 页面卸载时刷新队列
  window.addEventListener('beforeunload', () => {
    if (activityQueue.length > 0) {
      // 使用 sendBeacon 发送最后一批数据
      flushActivities();
    }
  });

  // 公共API
  window.AnalyticsService = {
    /**
     * 记录页面浏览
     */
    logPageView(pagePath, pageTitle) {
      logActivity({
        type: 'page_view',
        page_path: pagePath || window.location.pathname,
        page_title: pageTitle || document.title
      });
    },

    /**
     * 记录搜索行为
     */
    logSearch(query) {
      if (!query || query.trim() === '') return;
      
      logActivity({
        type: 'search',
        search_query: query.trim()
      });
    },

    /**
     * 记录点击行为
     */
    logClick(targetUrl, linkText) {
      logActivity({
        type: 'click',
        target_url: targetUrl,
        metadata: {
          link_text: linkText
        }
      });
    },

    /**
     * 记录收藏行为
     */
    logFavorite(postUrl, isFavorited) {
      logActivity({
        type: 'favorite',
        target_url: postUrl,
        metadata: {
          action: isFavorited ? 'add' : 'remove'
        }
      });
    },

    /**
     * 记录自定义活动
     */
    logCustom(type, data) {
      logActivity({
        type: type,
        ...data
      });
    }
  };

  // 自动记录页面浏览
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.AnalyticsService.logPageView();
    });
  } else {
    window.AnalyticsService.logPageView();
  }

  // 监听 Turbolinks 页面变化
  document.addEventListener('turbolinks:load', () => {
    window.AnalyticsService.logPageView();
  });

  console.log('[Analytics] 📊 用户活动追踪服务已加载');
})();

