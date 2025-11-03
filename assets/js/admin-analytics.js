/**
 * 管理后台分析服务
 * 用于获取和显示用户活跃度分析数据
 */

(function() {
  'use strict';

  // 获取 Supabase 客户端辅助函数
  function getSupabase() {
    if (window.getSupabaseClient) {
      return window.getSupabaseClient();
    }
    return null;
  }

  window.AdminAnalytics = {
    /**
     * 获取日活跃用户数
     */
    async getDailyActiveUsers(date = null) {
      const supabase = getSupabase();
      if (!supabase) {
        console.error('[AdminAnalytics] Supabase client not available');
        return null;
      }

      try {
        const queryDate = date || new Date().toISOString().split('T')[0];
        console.log('[AdminAnalytics] 调用 get_daily_active_users，日期:', queryDate);
        
        const { data, error } = await supabase
          .rpc('get_daily_active_users', {
            p_date: queryDate
          });

        if (error) {
          console.error('[AdminAnalytics] RPC 错误:', error);
          console.error('[AdminAnalytics] 错误详情:', error.message, error.code, error.details, error.hint);
          throw error;
        }
        
        console.log('[AdminAnalytics] get_daily_active_users 返回:', data);
        // RPC 函数返回的是 INTEGER，直接返回数字
        return data !== null && data !== undefined ? data : 0;
      } catch (error) {
        console.error('[AdminAnalytics] Failed to get DAU:', error);
        console.error('[AdminAnalytics] Error stack:', error.stack);
        return null;
      }
    },

    /**
     * 获取指定日期范围内的活跃用户数
     */
    async getActiveUsersInRange(startDate, endDate) {
      const supabase = getSupabase();
      if (!supabase) {
        console.error('[AdminAnalytics] Supabase client not available');
        return null;
      }

      try {
        console.log('[AdminAnalytics] 调用 get_active_users_in_range，日期范围:', startDate, '到', endDate);
        
        const { data, error } = await supabase
          .rpc('get_active_users_in_range', {
            p_start_date: startDate,
            p_end_date: endDate
          });

        if (error) {
          console.error('[AdminAnalytics] RPC 错误:', error);
          console.error('[AdminAnalytics] 错误详情:', error.message, error.code, error.details, error.hint);
          throw error;
        }
        
        console.log('[AdminAnalytics] get_active_users_in_range 返回:', data);
        return data || [];
      } catch (error) {
        console.error('[AdminAnalytics] Failed to get active users:', error);
        console.error('[AdminAnalytics] Error stack:', error.stack);
        return null;
      }
    },

    /**
     * 获取热门页面
     */
    async getPopularPages(startDate = null, endDate = null, limit = 20) {
      const supabase = getSupabase();
      if (!supabase) {
        console.error('[AdminAnalytics] Supabase client not available');
        return null;
      }

      try {
        const { data, error } = await supabase
          .rpc('get_popular_pages', {
            p_start_date: startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            p_end_date: endDate || new Date().toISOString().split('T')[0],
            p_limit: limit
          });

        if (error) throw error;
        return data;
      } catch (error) {
        console.error('[AdminAnalytics] Failed to get popular pages:', error);
        return null;
      }
    },

    /**
     * 获取搜索热词
     */
    async getSearchKeywords(startDate = null, endDate = null, limit = 20) {
      const supabase = getSupabase();
      if (!supabase) {
        console.error('[AdminAnalytics] Supabase client not available');
        return null;
      }

      try {
        const { data, error } = await supabase
          .rpc('get_search_keywords', {
            p_start_date: startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            p_end_date: endDate || new Date().toISOString().split('T')[0],
            p_limit: limit
          });

        if (error) throw error;
        return data;
      } catch (error) {
        console.error('[AdminAnalytics] Failed to get search keywords:', error);
        return null;
      }
    },

    /**
     * 获取用户留存率
     */
    async getUserRetention(startDate = null, endDate = null) {
      const supabase = getSupabase();
      if (!supabase) {
        console.error('[AdminAnalytics] Supabase client not available');
        return null;
      }

      try {
        const { data, error } = await supabase
          .rpc('get_user_retention', {
            p_start_date: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            p_end_date: endDate || new Date().toISOString().split('T')[0]
          });

        if (error) throw error;
        return data;
      } catch (error) {
        console.error('[AdminAnalytics] Failed to get user retention:', error);
        return null;
      }
    },

    /**
     * 格式化日期
     */
    formatDate(date) {
      return new Date(date).toLocaleDateString('zh-CN');
    },

    /**
     * 格式化百分比
     */
    formatPercent(value, total) {
      if (!total || total === 0) return '0%';
      return ((value / total) * 100).toFixed(1) + '%';
    }
  };

  console.log('[AdminAnalytics] 📊 管理后台分析服务已加载');
  console.log('[AdminAnalytics] window.AdminAnalytics 已定义:', typeof window.AdminAnalytics);
})();

