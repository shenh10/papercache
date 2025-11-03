// 收藏功能服务模块
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
    // 更快速地等待客户端初始化，最多等待500ms
    let waitCount = 0;
    const checkInterval = setInterval(() => {
      waitCount++;
      const client = getSupabaseClient();
      if (client) {
        clearInterval(checkInterval);
        initFavoritesService(client);
      } else if (waitCount > 5) { // 减少到500ms
        clearInterval(checkInterval);
        console.error('Supabase客户端初始化超时，收藏功能不可用');
      }
    }, 100);
    return;
  }
  
  initFavoritesService(supabase);
  
  function initFavoritesService(supabase) {
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
    // 收藏管理
    // ============================================

    // 收藏文章
    async function favoritePost(postUrl) {
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
          .from('favorites')
          .insert({
            user_id: user.id,
            post_url: normalizedUrl
          })
          .select()
          .single();

        if (error) {
          // 如果是重复收藏（违反唯一约束），返回成功
          if (error.code === '23505') {
            return { success: true, favorited: true };
          }
          throw error;
        }

        return { success: true, favorited: true, data };
      } catch (error) {
        console.error('收藏失败:', error);
        return { success: false, error: error.message };
      }
    }

    // 取消收藏
    async function unfavoritePost(postUrl) {
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
          .from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('post_url', normalizedUrl);

        if (error) throw error;

        return { success: true, favorited: false };
      } catch (error) {
        console.error('取消收藏失败:', error);
        return { success: false, error: error.message };
      }
    }

    // 切换收藏状态
    async function toggleFavorite(postUrl) {
      const isFavorited = await isPostFavorited(postUrl);
      if (isFavorited) {
        return await unfavoritePost(postUrl);
      } else {
        return await favoritePost(postUrl);
      }
    }

    // 检查文章是否已收藏
    async function isPostFavorited(postUrl) {
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
          .from('favorites')
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
        console.error('检查收藏状态失败:', error);
        return false;
      }
    }

    // 获取用户所有收藏
    async function getUserFavorites() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          return { success: false, error: '请先登录', favorites: [] };
        }

        const { data, error } = await supabase
          .from('favorites')
          .select('post_url, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        return { success: true, favorites: data || [] };
      } catch (error) {
        console.error('获取收藏列表失败:', error);
        return { success: false, error: error.message, favorites: [] };
      }
    }

    // 获取文章的收藏数（公开统计）
    // 优先使用PostgreSQL聚合函数（更高效），如果失败则降级到原有方法
    async function getPostFavoriteCount(postUrl) {
      try {
        // 规范化URL，确保与存储格式一致
        const normalizedUrl = normalizeUrl(postUrl);
        if (!normalizedUrl || normalizedUrl === '/') {
          return { success: false, error: '无效的URL', count: 0 };
        }

        // 尝试使用RPC函数（PostgreSQL聚合函数）
        try {
          const { data: rpcCount, error: rpcError } = await supabase.rpc('get_favorite_count', {
            p_url: normalizedUrl
          });
          
          if (!rpcError && typeof rpcCount === 'number') {
            return { success: true, count: rpcCount };
          } else if (rpcError) {
            // 如果是函数不存在的错误（42883），静默降级
            if (rpcError.code !== '42883' && rpcError.code !== 'P0001') {
              console.warn('[favorites] getPostFavoriteCount RPC函数调用失败，使用降级方案:', rpcError);
            }
          }
        } catch (rpcError) {
          // RPC函数可能不存在，使用降级方案（静默处理）
        }

        // 降级方案：使用原有的查询方法
        const { count, error } = await supabase
          .from('favorites')
          .select('*', { count: 'exact', head: true })
          .eq('post_url', normalizedUrl);

        if (error) throw error;

        return { success: true, count: count || 0 };
      } catch (error) {
        console.error('获取收藏数失败:', error);
        return { success: false, error: error.message, count: 0 };
      }
    }

    // 批量获取多个文章的收藏数
    // 优先使用PostgreSQL聚合函数（更高效），如果失败则降级到原有方法
    async function batchGetFavoriteCounts(postUrls) {
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
          const { data: rpcData, error: rpcError } = await supabase.rpc('batch_get_favorite_counts', {
            p_urls: normalizedUrls
          });
          
          if (!rpcError && rpcData && typeof rpcData === 'object') {
            // RPC函数返回JSON对象，键为post_url，值为收藏数
            // 需要构建原始URL到计数的映射
            const result = {};
            postUrls.forEach(originalUrl => {
              const normalized = normalizeUrl(originalUrl);
              result[originalUrl] = rpcData[normalized] || 0;
            });
            return result;
          } else if (rpcError) {
            // 如果是函数不存在的错误（42883），静默降级
            if (rpcError.code !== '42883' && rpcError.code !== 'P0001') {
              console.warn('[favorites] RPC函数调用失败，使用降级方案:', rpcError);
            }
          }
        } catch (rpcError) {
          // RPC函数可能不存在，使用降级方案（静默处理）
        }
        
        // 降级方案：使用原有的批量查询方法
        return await batchGetFavoriteCountsFallback(postUrls, normalizedUrls);
      } catch (error) {
        console.error('[favorites] batchGetFavoriteCounts: 批量获取收藏数失败', error);
        return {};
      }
    }
    
    // 降级方案：原有的批量查询方法（保留作为后备）
    async function batchGetFavoriteCountsFallback(postUrls, normalizedUrls = null) {
      try {
        if (!postUrls || !Array.isArray(postUrls) || postUrls.length === 0) {
          return {};
        }

        // 如果没有传入normalizedUrls，重新规范化
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

        // 缓存规范化结果，避免重复计算
        const urlNormalizationCache = new Map();
        const cachedNormalize = (url) => {
          if (urlNormalizationCache.has(url)) {
            return urlNormalizationCache.get(url);
          }
          const normalized = normalizeUrl(url);
          urlNormalizationCache.set(url, normalized);
          return normalized;
        };

        // 规范化并过滤无效URL，同时保留原始URL映射
        const urlMapping = [];
        const normalizedUrls = postUrls
          .map((originalUrl, index) => {
            try {
              const normalized = cachedNormalize(originalUrl);
              // 确保规范化后的URL是有效的字符串
              if (typeof normalized !== 'string' || normalized.length === 0 || normalized === '/') {
                return null;
              }
              urlMapping.push({ original: originalUrl, normalized });
              return normalized;
            } catch (e) {
              console.warn('[favorites] batchGetFavoriteCounts: URL规范化失败:', originalUrl, e);
              return null;
            }
          })
          .filter(url => url !== null && url !== undefined && url !== '' && url !== '/');
        
        if (normalizedUrls.length === 0) {
          return {};
        }

        // Supabase的.in()方法对数组大小有限制，需要分批查询
        // 减小批次大小以提高响应速度（虽然会增加请求次数，但单个请求更快）
        const BATCH_SIZE = 50; // 减小批次大小以优化性能
        const countsMap = {};
        
        // 初始化所有URL的计数为0
        normalizedUrls.forEach(url => {
          countsMap[url] = 0;
        });

        // 并行分批查询
        const batches = [];
        for (let i = 0; i < normalizedUrls.length; i += BATCH_SIZE) {
          const batch = normalizedUrls.slice(i, i + BATCH_SIZE);

          if (batch.length === 0) continue;

          // 确保批次中的 URL 都是有效的字符串
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

        // 并行执行所有批次查询
        // 使用聚合查询优化性能，直接在数据库层面统计计数
        const batchPromises = batches.map(async (batch, batchIndex) => {
          try {
            // 方法1：尝试使用聚合查询（更高效，但Supabase可能需要RPC函数）
            // 方法2：如果聚合不支持，使用简单的select但限制返回字段
            // 这里先尝试使用select，但可以优化为RPC函数
            
            // 查询这些 URL 的收藏数
            // 只选择post_url字段，减少数据传输量
            // 注意：Supabase的select不支持聚合函数，所以需要在客户端统计
            // 如果需要更好的性能，可以创建PostgreSQL函数来聚合统计
            const { data, error } = await supabase
              .from('favorites')
              .select('post_url')
              .in('post_url', batch);

            if (error) {
              console.error('[favorites] batchGetFavoriteCounts: Supabase查询错误', {
                error,
                batchSize: batch.length,
                batchIndex,
                sampleUrls: batch.slice(0, 3)
              });
              return [];
            }

            return data || [];
          } catch (batchError) {
            console.error('[favorites] batchGetFavoriteCounts: 批次查询失败', {
              error: batchError,
              batchIndex,
              batchSize: batch.length
            });
            return [];
          }
        });

        // 等待所有批次完成（并行执行，但限制并发数以避免过载）
        // 如果批次太多，可以分批执行Promise.all以避免过载
        const MAX_CONCURRENT_BATCHES = 5; // 最多同时执行5个批次
        
        let allResults = [];
        if (batchPromises.length <= MAX_CONCURRENT_BATCHES) {
          // 批次不多，直接并行执行所有
          allResults = await Promise.all(batchPromises);
        } else {
          // 批次太多，分批并行执行以避免过载
          for (let i = 0; i < batchPromises.length; i += MAX_CONCURRENT_BATCHES) {
            const concurrentBatches = batchPromises.slice(i, i + MAX_CONCURRENT_BATCHES);
            const batchResults = await Promise.all(concurrentBatches);
            allResults.push(...batchResults);
          }
        }

        // 处理所有结果
        allResults.forEach(data => {
          if (data && Array.isArray(data)) {
            data.forEach(item => {
              // 数据库返回的 URL 也需要规范化，确保匹配（使用缓存）
              const dbUrl = cachedNormalize(item.post_url);
              if (dbUrl in countsMap) {
                countsMap[dbUrl] = (countsMap[dbUrl] || 0) + 1;
              } else {
                // 如果规范化后不匹配，尝试直接使用原始URL
                const originalUrl = item.post_url;
                if (originalUrl in countsMap) {
                  countsMap[originalUrl] = (countsMap[originalUrl] || 0) + 1;
                }
              }
            });
          }
        });

        // 构建原始 URL 到计数的映射
        const result = {};
        urlMapping.forEach(({ original, normalized }) => {
          result[original] = countsMap[normalized] || 0;
        });

        return result;
      } catch (error) {
        console.error('[favorites] batchGetFavoriteCounts: 批量获取收藏数失败', error);
        return {};
      }
    }

    // ============================================
    // 批量检查收藏状态
    // ============================================

    // 批量检查多个文章的收藏状态
    async function batchCheckFavorites(postUrls) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !postUrls || postUrls.length === 0) {
          return {};
        }

        // 缓存规范化结果，避免重复计算
        const urlNormalizationCache = new Map();
        const cachedNormalize = (url) => {
          if (urlNormalizationCache.has(url)) {
            return urlNormalizationCache.get(url);
          }
          const normalized = normalizeUrl(url);
          urlNormalizationCache.set(url, normalized);
          return normalized;
        };

        // 规范化所有URL（使用缓存）
        const normalizedUrls = postUrls.map(cachedNormalize).filter(url => url && url !== '/');

        if (normalizedUrls.length === 0) {
          return {};
        }

        // 构建URL映射，避免重复规范化
        const urlMap = {};
        postUrls.forEach((originalUrl) => {
          const normalized = cachedNormalize(originalUrl);
          if (normalized && normalized !== '/') {
            if (!urlMap[normalized]) {
              urlMap[normalized] = [];
            }
            urlMap[normalized].push(originalUrl);
          }
        });

        const { data, error } = await supabase
          .from('favorites')
          .select('post_url')
          .eq('user_id', user.id)
          .in('post_url', normalizedUrls);

        if (error) {
          console.error('[favorites] batchCheckFavorites: Supabase查询错误', error);
          throw error;
        }

        // 构建一个Set，便于快速查找（使用缓存规范化）
        const favoritedSet = new Set((data || []).map(item => {
          return cachedNormalize(item.post_url);
        }));

        const result = {};
        postUrls.forEach(url => {
          const normalized = cachedNormalize(url);
          const isFavorited = favoritedSet.has(normalized);
          result[url] = isFavorited;
        });

        return result;
      } catch (error) {
        console.error('[favorites] 批量检查收藏状态失败:', error);
        return {};
      }
    }

    // ============================================
    // 导出API
    // ============================================

    window.favoritesService = {
      favoritePost,
      unfavoritePost,
      toggleFavorite,
      isPostFavorited,
      getUserFavorites,
      getPostFavoriteCount,
      batchCheckFavorites,
      batchGetFavoriteCounts
    };
  }
})();

