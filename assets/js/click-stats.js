// 点击统计服务 - 使用 Supabase
(function() {
  'use strict';
  
  let supabase = null;
  let initialized = false;
  
  // 初始化点击统计服务
  function initClickStatsService(supabaseClient) {
    if (initialized) return;
    supabase = supabaseClient;
    initialized = true;
  }
  
  // 等待 Supabase 客户端初始化
  function waitForSupabase() {
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 50;
      
      const checkSupabase = setInterval(() => {
        if (window.getSupabaseClient) {
          const client = window.getSupabaseClient();
          if (client) {
            clearInterval(checkSupabase);
            initClickStatsService(client);
            resolve(client);
            return;
          }
        }
        
        attempts++;
        if (attempts >= maxAttempts) {
          clearInterval(checkSupabase);
          resolve(null);
        }
      }, 100);
    });
  }
  
  // 规范化 URL
  function normalizeUrl(url) {
    if (!url || typeof url !== 'string') return '';
    
    try {
      // 处理完整的URL
      if (url.startsWith('http://') || url.startsWith('https://')) {
        const urlObj = new URL(url);
        let pathname = urlObj.pathname;
        // 移除baseurl前缀（如果存在）
        const baseurl = window.PC_BASEURL || '';
        if (baseurl && baseurl !== '/' && pathname.startsWith(baseurl)) {
          pathname = pathname.substring(baseurl.length);
        }
        if (!pathname.startsWith('/')) {
          pathname = '/' + pathname;
        }
        return pathname;
      }
      
      // 处理相对路径
      let normalized = url.trim();
      
      // 移除baseurl前缀（如果存在）
      const baseurl = window.PC_BASEURL || '';
      if (baseurl && baseurl !== '/' && normalized.startsWith(baseurl)) {
        normalized = normalized.substring(baseurl.length);
      }
      
      // 确保以 / 开头
      if (!normalized.startsWith('/')) {
        normalized = '/' + normalized;
      }
      
      // 移除尾部斜杠（除了根路径）
      if (normalized.length > 1 && normalized.endsWith('/')) {
        normalized = normalized.slice(0, -1);
      }
      
      return normalized;
    } catch (e) {
      console.warn('ClickStats: URL规范化异常:', url, e);
      return '';
    }
  }
  
  // 记录文章点击（使用 PostgreSQL 函数原子性增加）
  async function trackClick(postUrl) {
    if (!supabase) {
      await waitForSupabase();
    }
    
    if (!supabase) {
      console.error('[ClickStats] Supabase client not available');
      return { success: false, error: 'Supabase client not available' };
    }
    
    const normalizedUrl = normalizeUrl(postUrl);
    
    if (!normalizedUrl || normalizedUrl === '/') {
      console.error('[ClickStats] 无效的URL:', postUrl, '规范化后:', normalizedUrl);
      return { success: false, error: 'Invalid URL' };
    }
    
    console.log('[ClickStats] 调用 increment_post_click, URL:', normalizedUrl);
    
    try {
      // 使用 PostgreSQL 函数原子性增加点击量
      const { data, error } = await supabase.rpc('increment_post_click', {
        p_url: normalizedUrl
      });
      
      if (error) {
        console.error('[ClickStats] RPC调用失败:', error, 'URL:', normalizedUrl);
        // 如果RPC函数不存在，尝试直接更新表
        if (error.code === '42883' || error.message?.includes('function') || error.message?.includes('does not exist')) {
          console.warn('[ClickStats] RPC函数不存在，尝试直接更新表');
          return await trackClickFallback(normalizedUrl);
        }
        return { success: false, error: error.message };
      }
      
      console.log('[ClickStats] 点击量更新成功:', normalizedUrl, '新计数:', data);
      return { success: true, clickCount: data };
    } catch (error) {
      console.error('[ClickStats] 点击追踪异常:', error, 'URL:', normalizedUrl);
      return { success: false, error: error.message };
    }
  }
  
  // 降级方案：直接更新表（如果RPC函数不存在）
  async function trackClickFallback(normalizedUrl) {
    try {
      console.log('[ClickStats] 使用降级方案更新点击量:', normalizedUrl);
      
      // 先尝试查询是否存在
      const { data: existing, error: queryError } = await supabase
        .from('post_clicks')
        .select('click_count')
        .eq('post_url', normalizedUrl)
        .maybeSingle();
      
      if (queryError && queryError.code !== 'PGRST116') {
        console.error('[ClickStats] 查询现有记录失败:', queryError);
        return { success: false, error: queryError.message };
      }
      
      if (existing) {
        // 更新现有记录
        const { data, error } = await supabase
          .from('post_clicks')
          .update({ 
            click_count: (existing.click_count || 0) + 1,
            updated_at: new Date().toISOString()
          })
          .eq('post_url', normalizedUrl)
          .select('click_count')
          .single();
        
        if (error) {
          console.error('[ClickStats] 更新失败:', error);
          return { success: false, error: error.message };
        }
        
        console.log('[ClickStats] 更新成功，新计数:', data?.click_count);
        return { success: true, clickCount: data?.click_count || 0 };
      } else {
        // 插入新记录
        const { data, error } = await supabase
          .from('post_clicks')
          .insert({
            post_url: normalizedUrl,
            click_count: 1
          })
          .select('click_count')
          .single();
        
        if (error) {
          console.error('[ClickStats] 插入失败:', error);
          return { success: false, error: error.message };
        }
        
        console.log('[ClickStats] 插入成功，新计数:', data?.click_count);
        return { success: true, clickCount: data?.click_count || 1 };
      }
    } catch (error) {
      console.error('[ClickStats] Fallback方案失败:', error);
      return { success: false, error: error.message };
    }
  }
  
  // 获取单个文章的点击量
  async function getPostClickCount(postUrl) {
    if (!supabase) {
      await waitForSupabase();
    }
    
    if (!supabase) {
      return 0;
    }
    
    const normalizedUrl = normalizeUrl(postUrl);
    
    try {
      const { data, error } = await supabase
        .from('post_clicks')
        .select('click_count')
        .eq('post_url', normalizedUrl)
        .maybeSingle();
      
      if (error) {
        console.error('ClickStats: Failed to get click count', error);
        return 0;
      }
      
      return data?.click_count || 0;
    } catch (error) {
      console.error('ClickStats: Error getting click count', error);
      return 0;
    }
  }
  
  // 批量获取多个文章的点击量
  async function batchGetClickCounts(postUrls) {
    if (!supabase) {
      await waitForSupabase();
    }
    
    if (!supabase) {
      return {};
    }
    
    if (!postUrls || !Array.isArray(postUrls) || postUrls.length === 0) {
      return {};
    }
    
    // 规范化所有 URL，并过滤无效值
    const normalizedUrls = postUrls
      .map(url => {
        try {
          const normalized = normalizeUrl(url);
          // 确保规范化后的URL是有效的字符串
          if (typeof normalized !== 'string' || normalized.length === 0 || normalized === '/') {
            return null;
          }
          return normalized;
        } catch (e) {
          console.warn('ClickStats: URL规范化失败:', url, e);
          return null;
        }
      })
      .filter(url => url !== null && url !== undefined && url !== '' && url !== '/');
    
    if (normalizedUrls.length === 0) {
      return {};
    }
    
    // Supabase的.in()方法对数组大小有限制（通常1000），需要分批查询
    // 但根据错误，可能需要更小的批次大小
    const BATCH_SIZE = 100; // 减小批次大小，避免参数过多导致400错误
    const allResults = {};
    
    try {
      // 分批查询
      for (let i = 0; i < normalizedUrls.length; i += BATCH_SIZE) {
        const batch = normalizedUrls.slice(i, i + BATCH_SIZE);
        
        if (batch.length === 0) continue;
        
        // 确保批次中的 URL 都是有效的字符串
        const validBatch = batch.filter(url => {
          if (typeof url !== 'string' || url.length === 0) {
            console.warn('ClickStats: 过滤无效URL:', url);
            return false;
          }
          return true;
        });
        
        if (validBatch.length === 0) {
          console.warn('ClickStats: 批次中没有有效URL');
          continue;
        }
        
        // 检查表是否存在（通过尝试查询来验证）
        const { data, error } = await supabase
          .from('post_clicks')
          .select('post_url, click_count')
          .in('post_url', validBatch);
        
        if (error) {
          console.error('ClickStats: Failed to batch get click counts', error);
          console.error('ClickStats: Error details:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
          });
          console.error('ClickStats: Batch URLs (first 10):', validBatch.slice(0, 10));
          console.error('ClickStats: Batch size:', validBatch.length);
          console.error('ClickStats: Sample URL type check:', typeof validBatch[0], 'Length:', validBatch[0]?.length);
          // 如果是表不存在或权限问题，不要再继续
          if (error.code === 'PGRST116' || error.message?.includes('relation') || error.message?.includes('permission')) {
            console.error('ClickStats: 表或权限问题，停止批量查询');
            break;
          }
          // 继续处理下一批，而不是完全失败
          continue;
        }
        
        // 合并结果
        if (data && Array.isArray(data)) {
          data.forEach(item => {
            if (item && item.post_url) {
              allResults[item.post_url] = item.click_count || 0;
            }
          });
        }
      }
      
      // 确保所有请求的 URL 都在结果中（没有点击量的设为 0）
      normalizedUrls.forEach(url => {
        if (!(url in allResults)) {
          allResults[url] = 0;
        }
      });
      
      // 同时构建原始 URL 到计数的映射（如果原始URL和规范化URL不同）
      const result = {};
      postUrls.forEach((originalUrl, index) => {
        try {
          const normalized = normalizeUrl(originalUrl);
          result[originalUrl] = allResults[normalized] || 0;
        } catch (e) {
          result[originalUrl] = 0;
        }
      });
      
      return result;
    } catch (error) {
      console.error('ClickStats: Error batch getting click counts', error);
      console.error('ClickStats: PostUrls sample:', postUrls.slice(0, 5));
      return {};
    }
  }
  
  // 获取点击量最高的文章
  async function getTopPosts(limit = 10) {
    if (!supabase) {
      await waitForSupabase();
    }
    
    if (!supabase) {
      return [];
    }
    
    try {
      const { data, error } = await supabase
        .from('post_clicks')
        .select('post_url, click_count')
        .order('click_count', { ascending: false })
        .limit(limit);
      
      if (error) {
        console.error('ClickStats: Failed to get top posts', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('ClickStats: Error getting top posts', error);
      return [];
    }
  }
  
  // 导出 API
  window.clickStatsService = {
    trackClick,
    getPostClickCount,
    batchGetClickCounts,
    getTopPosts,
    init: initClickStatsService
  };
  
  // 如果 Supabase 已加载，立即初始化
  if (window.getSupabaseClient) {
    const client = window.getSupabaseClient();
    if (client) {
      initClickStatsService(client);
    }
  }
})();

