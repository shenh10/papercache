// Supabase客户端初始化
// 从配置文件或环境变量读取Supabase配置

(function() {
  'use strict';

  // 从页面配置中读取Supabase配置
  function getSupabaseConfig() {
    // 方法1: 从window.siteConfig读取（Jekyll注入）
    if (window.siteConfig && window.siteConfig.supabase) {
      return {
        url: window.siteConfig.supabase.url,
        anonKey: window.siteConfig.supabase.anon_key
      };
    }

    // 方法2: 从meta标签读取
    const metaUrl = document.querySelector('meta[name="supabase-url"]');
    const metaKey = document.querySelector('meta[name="supabase-anon-key"]');
    
    if (metaUrl && metaKey) {
      return {
        url: metaUrl.getAttribute('content'),
        anonKey: metaKey.getAttribute('content')
      };
    }

    // 方法3: 从data属性读取（fallback）
    const configElement = document.querySelector('[data-supabase-config]');
    if (configElement) {
      try {
        return JSON.parse(configElement.getAttribute('data-supabase-config'));
      } catch (e) {
        console.error('Failed to parse Supabase config:', e);
      }
    }

    return null;
  }

  // 初始化Supabase客户端
  let supabaseClient = null;

  function initSupabase() {
    const config = getSupabaseConfig();
    
    if (!config || !config.url || !config.anonKey) {
      console.warn('Supabase配置未找到，用户系统功能将不可用');
      return null;
    }

    // 动态加载Supabase SDK（如果未加载）
    if (typeof window.supabase === 'undefined') {
      console.error('Supabase SDK未加载，请确保已引入 @supabase/supabase-js');
      return null;
    }

    try {
      supabaseClient = window.supabase.createClient(config.url, config.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });

      console.log('Supabase客户端初始化成功');
      return supabaseClient;
    } catch (error) {
      console.error('Supabase客户端初始化失败:', error);
      return null;
    }
  }

  // 导出全局Supabase客户端
  window.getSupabaseClient = function() {
    if (!supabaseClient) {
      supabaseClient = initSupabase();
    }
    return supabaseClient;
  };

  // 页面加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSupabase);
  } else {
    initSupabase();
  }
})();

