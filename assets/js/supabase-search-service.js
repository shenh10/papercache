/**
 * Supabase 搜索服务
 * 提供论文全文搜索功能
 */

(function() {
  'use strict';

  // 等待 Supabase 客户端初始化
  function initSupabaseSearchService() {
    // 尝试多种方式获取 Supabase 客户端
    let supabase = null;
    
    if (window.supabaseClient) {
      supabase = window.supabaseClient;
    } else if (window._supabaseClientInstance) {
      supabase = window._supabaseClientInstance;
    } else if (window.getSupabaseClient && typeof window.getSupabaseClient === 'function') {
      supabase = window.getSupabaseClient();
    }
    
    if (!supabase) {
      console.warn('[supabase-search] Supabase 客户端未初始化，搜索功能不可用');
      return null;
    }

    /**
     * 搜索论文（模糊搜索，支持中文）
     * @param {string} query - 搜索关键词
     * @param {Object} options - 搜索选项
     * @returns {Promise<Object>} 搜索结果
     */
    async function searchPapers(query, options = {}) {
      const {
        tag = null,
        categories = null,
        limit = 50,
        matchMode = 'fuzzy' // 'fuzzy' 或 'fulltext'
      } = options;

      try {
        // 选择使用全文搜索还是模糊搜索
        const functionName = matchMode === 'fulltext' 
          ? 'search_posts_fulltext' 
          : 'search_posts_fuzzy';

        const params = {
          p_query: query || '',
          p_tag: tag,
          p_categories: categories,
          p_limit: limit
        };

        console.log('[supabase-search] 搜索请求:', { query, functionName, params });

        const { data, error } = await supabase.rpc(functionName, params);

        if (error) {
          console.error('[supabase-search] 搜索失败:', error);
          throw error;
        }

        console.log('[supabase-search] 搜索结果数量:', data?.length || 0);

        // 转换为统一格式
        const results = (data || []).map((item, index) => ({
          ref: item.post_url,
          score: item.relevance || item.match_score || (1.0 - index * 0.01)
        }));

        return {
          success: true,
          query,
          total: results.length,
          results: results,
          data: data // 保留原始数据
        };
      } catch (error) {
        console.error('[supabase-search] 搜索异常:', error);
        return {
          success: false,
          error: error.message,
          query,
          total: 0,
          results: []
        };
      }
    }

    /**
     * 获取论文详细信息（用于显示）
     * @param {string} postUrl - 论文URL
     * @returns {Promise<Object>} 论文信息
     */
    async function getPostInfo(postUrl) {
      try {
        const normalizedUrl = postUrl.startsWith('/') ? postUrl : '/' + postUrl;
        
        const { data, error } = await supabase
          .from('posts_search')
          .select('*')
          .eq('post_url', normalizedUrl)
          .maybeSingle();

        if (error) {
          console.error('[supabase-search] 获取论文信息失败:', error);
          return null;
        }

        return data;
      } catch (error) {
        console.error('[supabase-search] 获取论文信息异常:', error);
        return null;
      }
    }

    /**
     * 批量获取论文信息
     * @param {Array<string>} postUrls - 论文URL数组
     * @returns {Promise<Array>} 论文信息数组
     */
    async function batchGetPostInfo(postUrls) {
      try {
        const normalizedUrls = postUrls.map(url => 
          url.startsWith('/') ? url : '/' + url
        );

        const { data, error } = await supabase
          .from('posts_search')
          .select('*')
          .in('post_url', normalizedUrls);

        if (error) {
          console.error('[supabase-search] 批量获取论文信息失败:', error);
          return [];
        }

        return data || [];
      } catch (error) {
        console.error('[supabase-search] 批量获取论文信息异常:', error);
        return [];
      }
    }

    return {
      searchPapers,
      getPostInfo,
      batchGetPostInfo
    };
  }

  // 延迟初始化（等待 Supabase 客户端）
  function waitForSupabase() {
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 100; // 最多等待10秒

      // 检查 Supabase 客户端是否可用
      function checkSupabaseClient() {
        if (window.supabaseClient || 
            window._supabaseClientInstance || 
            (window.getSupabaseClient && window.getSupabaseClient())) {
          return true;
        }
        return false;
      }

      const checkInterval = setInterval(() => {
        attempts++;
        
        // 尝试获取客户端
        if (checkSupabaseClient()) {
          clearInterval(checkInterval);
          const service = initSupabaseSearchService();
          resolve(service);
        } else if (attempts >= maxAttempts) {
          clearInterval(checkInterval);
          console.warn('[supabase-search] Supabase 客户端初始化超时（尝试了', attempts, '次）');
          console.warn('[supabase-search] 检查配置:', {
            hasSupabaseClient: !!window.supabaseClient,
            hasSupabaseInstance: !!window._supabaseClientInstance,
            hasGetSupabaseClient: typeof window.getSupabaseClient === 'function',
            hasSiteConfig: !!window.siteConfig,
            hasSupabaseConfig: !!(window.siteConfig && window.siteConfig.supabase)
          });
          resolve(null);
        }
      }, 100);
    });
  }

  // 初始化服务
  function initializeService() {
    waitForSupabase().then(service => {
      if (service) {
        window.SupabaseSearchService = service;
        console.log('[supabase-search] ✅ Supabase 搜索服务已初始化');
      } else {
        console.warn('[supabase-search] ⚠️  Supabase 搜索服务初始化失败');
        // 即使初始化失败，也设置一个空对象，避免后续调用出错
        window.SupabaseSearchService = {
          searchPapers: async () => ({ success: false, error: 'Supabase 未初始化', results: [] }),
          getPostInfo: async () => null,
          batchGetPostInfo: async () => []
        };
      }
    });
  }

  // 如果 DOM 已加载，立即初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeService);
  } else {
    // DOM 已加载，延迟一点确保其他脚本已运行
    setTimeout(initializeService, 200);
  }

})();

