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

  // 初始化Supabase客户端（单例模式，确保全局只有一个实例）
  let supabaseClient = null;
  let isInitializing = false;

  function initSupabase() {
    // 如果已经有客户端实例，直接返回（避免创建多个实例）
    if (supabaseClient) {
      return supabaseClient;
    }
    
    // 检查全局是否已有实例（避免多个脚本创建多个实例）
    if (window._supabaseClientInstance) {
      supabaseClient = window._supabaseClientInstance;
      return supabaseClient;
    }
    
    // 如果正在初始化，等待完成
    if (isInitializing) {
      return null;
    }
    
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
      isInitializing = true;
      
      // 使用统一的storage key，确保多个页面共享同一个session
      supabaseClient = window.supabase.createClient(config.url, config.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: window.localStorage, // 明确使用localStorage
          storageKey: 'supabase.auth.token' // 统一的storage key，避免多个实例冲突
        }
      });
      
      // 保存到全局，避免重复创建
      window._supabaseClientInstance = supabaseClient;

      isInitializing = false;
      console.log('Supabase客户端初始化成功（单例模式）');
      return supabaseClient;
    } catch (error) {
      isInitializing = false;
      console.error('Supabase客户端初始化失败:', error);
      return null;
    }
  }

  // 导出全局Supabase客户端（单例模式）
  window.getSupabaseClient = function() {
    if (supabaseClient) {
      return supabaseClient;
    }
    if (window._supabaseClientInstance) {
      supabaseClient = window._supabaseClientInstance;
      return supabaseClient;
    }
    return initSupabase();
  };

  // 同时导出到 window.supabaseClient（兼容性）
  // 监听初始化完成事件
  function setSupabaseClient() {
    const client = window.getSupabaseClient();
    if (client) {
      window.supabaseClient = client;
    }
  }
  
  // 延迟设置，确保初始化完成
  setTimeout(setSupabaseClient, 100);
  
  // 如果 DOM 已经加载，立即尝试设置
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(setSupabaseClient, 500);
  }
  
  // 监听 DOMContentLoaded 事件
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(setSupabaseClient, 300);
  });

  // 页面加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSupabase);
  } else {
    initSupabase();
  }
})();

