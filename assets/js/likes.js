// 点赞功能服务模块
(function() {
  'use strict';

  // 等待Supabase客户端初始化
  function getSupabaseClient() {
    if (window.getSupabaseClient) {
      return window.getSupabaseClient();
    }
    return null;
  }

  const supabase = getSupabaseClient();
  
  if (!supabase) {
    console.warn('Supabase客户端未初始化，等待初始化...');
    let waitCount = 0;
    const checkInterval = setInterval(() => {
      waitCount++;
      const client = getSupabaseClient();
      if (client) {
        clearInterval(checkInterval);
        initLikesService(client);
      } else if (waitCount > 5) {
        clearInterval(checkInterval);
        console.error('Supabase客户端初始化超时，点赞功能不可用');
      }
    }, 100);
    return;
  }
  
  initLikesService(supabase);
  
  function initLikesService(supabase) {
    // ============================================
    // URL规范化函数（统一使用）
    // ============================================
    
    const normalizeUrl = (url) => {
      if (!url || typeof url !== 'string') return '';
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
      
      // 移除尾部斜杠（除了根路径），确保存储和查询格式一致
      if (normalized.length > 1 && normalized.endsWith('/')) {
        normalized = normalized.slice(0, -1);
      }
      
      return normalized;
    };

    // ============================================
    // 点赞管理
    // ============================================

    // 点赞文章
    async function likePost(postUrl) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          // 如果未登录，打开登录模态框
          if (window.openAuthModal) {
            window.openAuthModal('login');
          }
          return { success: false, error: '请先登录' };
        }

        // 规范化URL，确保存储格式一致
        const normalizedUrl = normalizeUrl(postUrl);
        if (!normalizedUrl || normalizedUrl === '/') {
          return { success: false, error: '无效的URL' };
        }

        const { data, error } = await supabase
          .from('likes')
          .insert({
            user_id: user.id,
            post_url: normalizedUrl
          })
          .select()
          .single();

        if (error) {
          // 如果是重复点赞（违反唯一约束），返回成功
          if (error.code === '23505') {
            return { success: true, liked: true };
          }
          throw error;
        }

        return { success: true, liked: true, data };
      } catch (error) {
        console.error('点赞失败:', error);
        return { success: false, error: error.message };
      }
    }

    // 取消点赞
    async function unlikePost(postUrl) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          return { success: false, error: '请先登录' };
        }

        // 规范化URL，确保与存储格式一致
        const normalizedUrl = normalizeUrl(postUrl);
        if (!normalizedUrl || normalizedUrl === '/') {
          return { success: false, error: '无效的URL' };
        }

        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('user_id', user.id)
          .eq('post_url', normalizedUrl);

        if (error) throw error;

        return { success: true, liked: false };
      } catch (error) {
        console.error('取消点赞失败:', error);
        return { success: false, error: error.message };
      }
    }

    // 切换点赞状态
    async function toggleLike(postUrl) {
      const isLiked = await isPostLiked(postUrl);
      if (isLiked) {
        return await unlikePost(postUrl);
      } else {
        return await likePost(postUrl);
      }
    }

    // 检查文章是否已点赞
    async function isPostLiked(postUrl) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          return false;
        }

        // 规范化URL，确保与存储格式一致
        const normalizedUrl = normalizeUrl(postUrl);
        if (!normalizedUrl || normalizedUrl === '/') {
          return false;
        }

        const { data, error } = await supabase
          .from('likes')
          .select('id')
          .eq('user_id', user.id)
          .eq('post_url', normalizedUrl)
          .limit(1)
          .maybeSingle();

        if (error) {
          // 如果是未找到记录的错误（PGRST116），返回false
          if (error.code === 'PGRST116') {
            return false;
          }
          throw error;
        }

        return !!data;
      } catch (error) {
        console.error('检查点赞状态失败:', error);
        return false;
      }
    }

    // 获取文章的点赞数（公开统计）
    async function getPostLikeCount(postUrl) {
      try {
        // 规范化URL，确保与存储格式一致
        const normalizedUrl = normalizeUrl(postUrl);
        if (!normalizedUrl || normalizedUrl === '/') {
          return { success: false, error: '无效的URL', count: 0 };
        }

        // 尝试使用RPC函数（PostgreSQL聚合函数）
        try {
          const { data: rpcCount, error: rpcError } = await supabase.rpc('get_like_count', {
            p_url: normalizedUrl
          });
          
          if (!rpcError && typeof rpcCount === 'number') {
            return { success: true, count: rpcCount };
          } else if (rpcError) {
            // 如果是函数不存在的错误（42883），静默降级
            if (rpcError.code !== '42883' && rpcError.code !== 'P0001') {
              console.warn('[likes] getPostLikeCount RPC函数调用失败，使用降级方案:', rpcError);
            }
          }
        } catch (rpcError) {
          // RPC函数可能不存在，使用降级方案（静默处理）
        }

        // 降级方案：使用原有的查询方法
        const { count, error } = await supabase
          .from('likes')
          .select('*', { count: 'exact', head: true })
          .eq('post_url', normalizedUrl);

        if (error) throw error;

        return { success: true, count: count || 0 };
      } catch (error) {
        console.error('获取点赞数失败:', error);
        return { success: false, error: error.message, count: 0 };
      }
    }

    // 批量获取多个文章的点赞数
    async function batchGetLikeCounts(postUrls) {
      try {
        if (!postUrls || !Array.isArray(postUrls) || postUrls.length === 0) {
          return {};
        }

        // 规范化URL
        const normalizedUrls = postUrls
          .map(originalUrl => {
            try {
              const normalized = normalizeUrl(originalUrl);
              if (typeof normalized !== 'string' || normalized.length === 0 || normalized === '/') {
                return null;
              }
              return normalized;
            } catch (e) {
              return null;
            }
          })
          .filter(url => url !== null && url !== undefined && url !== '' && url !== '/');
        
        if (normalizedUrls.length === 0) {
          return {};
        }

        // 尝试使用RPC函数（PostgreSQL聚合函数）
        try {
          const { data: rpcData, error: rpcError } = await supabase.rpc('batch_get_like_counts', {
            p_urls: normalizedUrls
          });
          
          if (!rpcError && rpcData && typeof rpcData === 'object') {
            // RPC函数返回JSON对象，键为post_url，值为点赞数
            const result = {};
            postUrls.forEach(originalUrl => {
              const normalized = normalizeUrl(originalUrl);
              result[originalUrl] = rpcData[normalized] || 0;
            });
            return result;
          } else if (rpcError) {
            // 如果是函数不存在的错误（42883），静默降级
            if (rpcError.code !== '42883' && rpcError.code !== 'P0001') {
              console.warn('[likes] RPC函数调用失败，使用降级方案:', rpcError);
            }
          }
        } catch (rpcError) {
          // RPC函数可能不存在，使用降级方案（静默处理）
        }
        
        // 降级方案：使用原有的批量查询方法
        return await batchGetLikeCountsFallback(postUrls, normalizedUrls);
      } catch (error) {
        console.error('[likes] batchGetLikeCounts: 批量获取点赞数失败', error);
        return {};
      }
    }
    
    // 降级方案：原有的批量查询方法
    async function batchGetLikeCountsFallback(postUrls, normalizedUrls = null) {
      try {
        if (!postUrls || !Array.isArray(postUrls) || postUrls.length === 0) {
          return {};
        }

        if (!normalizedUrls) {
          normalizedUrls = postUrls
            .map(originalUrl => {
              try {
                const normalized = normalizeUrl(originalUrl);
                if (typeof normalized !== 'string' || normalized.length === 0 || normalized === '/') {
                  return null;
                }
                return normalized;
              } catch (e) {
                return null;
              }
            })
            .filter(url => url !== null && url !== undefined && url !== '' && url !== '/');
        }
        
        if (normalizedUrls.length === 0) {
          return {};
        }

        const urlNormalizationCache = new Map();
        const cachedNormalize = (url) => {
          if (urlNormalizationCache.has(url)) {
            return urlNormalizationCache.get(url);
          }
          const normalized = normalizeUrl(url);
          urlNormalizationCache.set(url, normalized);
          return normalized;
        };

        const urlMapping = [];
        const normalizedUrls = postUrls
          .map((originalUrl, index) => {
            try {
              const normalized = cachedNormalize(originalUrl);
              if (typeof normalized !== 'string' || normalized.length === 0 || normalized === '/') {
                return null;
              }
              urlMapping.push({ original: originalUrl, normalized });
              return normalized;
            } catch (e) {
              console.warn('[likes] batchGetLikeCounts: URL规范化失败:', originalUrl, e);
              return null;
            }
          })
          .filter(url => url !== null && url !== undefined && url !== '' && url !== '/');
        
        if (normalizedUrls.length === 0) {
          return {};
        }

        const BATCH_SIZE = 50;
        const countsMap = {};
        
        normalizedUrls.forEach(url => {
          countsMap[url] = 0;
        });

        const batches = [];
        for (let i = 0; i < normalizedUrls.length; i += BATCH_SIZE) {
          const batch = normalizedUrls.slice(i, i + BATCH_SIZE);

          if (batch.length === 0) continue;

          const validBatch = batch.filter(url => {
            if (typeof url !== 'string' || url.length === 0) {
              return false;
            }
            return true;
          });

          if (validBatch.length === 0) {
            continue;
          }

          batches.push(validBatch);
        }

        const batchPromises = batches.map(async (batch, batchIndex) => {
          try {
            const { data, error } = await supabase
              .from('likes')
              .select('post_url')
              .in('post_url', batch);

            if (error) {
              console.error('[likes] batchGetLikeCounts: Supabase查询错误', {
                error,
                batchSize: batch.length,
                batchIndex,
                sampleUrls: batch.slice(0, 3)
              });
              return [];
            }

            return data || [];
          } catch (batchError) {
            console.error('[likes] batchGetLikeCounts: 批次查询失败', {
              error: batchError,
              batchIndex,
              batchSize: batch.length
            });
            return [];
          }
        });

        const MAX_CONCURRENT_BATCHES = 5;
        let allResults = [];
        if (batchPromises.length <= MAX_CONCURRENT_BATCHES) {
          allResults = await Promise.all(batchPromises);
        } else {
          for (let i = 0; i < batchPromises.length; i += MAX_CONCURRENT_BATCHES) {
            const concurrentBatches = batchPromises.slice(i, i + MAX_CONCURRENT_BATCHES);
            const batchResults = await Promise.all(concurrentBatches);
            allResults.push(...batchResults);
          }
        }

        allResults.forEach(data => {
          if (data && Array.isArray(data)) {
            data.forEach(item => {
              const dbUrl = cachedNormalize(item.post_url);
              if (dbUrl in countsMap) {
                countsMap[dbUrl] = (countsMap[dbUrl] || 0) + 1;
              } else {
                const originalUrl = item.post_url;
                if (originalUrl in countsMap) {
                  countsMap[originalUrl] = (countsMap[originalUrl] || 0) + 1;
                }
              }
            });
          }
        });

        const result = {};
        urlMapping.forEach(({ original, normalized }) => {
          result[original] = countsMap[normalized] || 0;
        });

        return result;
      } catch (error) {
        console.error('[likes] batchGetLikeCounts: 批量获取点赞数失败', error);
        return {};
      }
    }

    // ============================================
    // 批量检查点赞状态
    // ============================================

    // 批量检查多个文章的点赞状态（优化版本：优先使用RPC函数）
    async function batchCheckLikes(postUrls) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !postUrls || postUrls.length === 0) {
          return {};
        }

        const urlNormalizationCache = new Map();
        const cachedNormalize = (url) => {
          if (urlNormalizationCache.has(url)) {
            return urlNormalizationCache.get(url);
          }
          const normalized = normalizeUrl(url);
          urlNormalizationCache.set(url, normalized);
          return normalized;
        };

        const normalizedUrls = postUrls.map(cachedNormalize).filter(url => url && url !== '/');

        if (normalizedUrls.length === 0) {
          return {};
        }

        // 优先使用RPC函数（更高效）
        try {
          const { data: rpcData, error: rpcError } = await supabase.rpc('batch_check_user_likes', {
            p_user_id: user.id,
            p_urls: normalizedUrls
          });
          
          if (!rpcError && rpcData && typeof rpcData === 'object') {
            const result = {};
            postUrls.forEach(originalUrl => {
              const normalized = cachedNormalize(originalUrl);
              result[originalUrl] = rpcData[normalized] === true;
            });
            return result;
          } else if (rpcError) {
            if (rpcError.code !== '42883' && rpcError.code !== 'P0001') {
              console.warn('[likes] batchCheckLikes RPC函数调用失败，使用降级方案:', rpcError);
            }
          }
        } catch (rpcError) {
          // RPC函数可能不存在，使用降级方案（静默处理）
        }

        // 降级方案：使用原有的客户端查询方法
        const { data, error } = await supabase
          .from('likes')
          .select('post_url')
          .eq('user_id', user.id)
          .in('post_url', normalizedUrls);

        if (error) {
          console.error('[likes] batchCheckLikes: Supabase查询错误', error);
          throw error;
        }

        const likedSet = new Set((data || []).map(item => {
          return cachedNormalize(item.post_url);
        }));

        const result = {};
        postUrls.forEach(url => {
          const normalized = cachedNormalize(url);
          const isLiked = likedSet.has(normalized);
          result[url] = isLiked;
        });

        return result;
      } catch (error) {
        console.error('[likes] 批量检查点赞状态失败:', error);
        return {};
      }
    }

    // ============================================
    // 导出API
    // ============================================

    window.likesService = {
      likePost,
      unlikePost,
      toggleLike,
      isPostLiked,
      getPostLikeCount,
      batchCheckLikes,
      batchGetLikeCounts
    };
  }
})();

