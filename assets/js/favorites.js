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
    // 等待客户端初始化，最多等待3秒
    let waitCount = 0;
    const checkInterval = setInterval(() => {
      waitCount++;
      const client = getSupabaseClient();
      if (client) {
        clearInterval(checkInterval);
        initFavoritesService(client);
      } else if (waitCount > 30) {
        clearInterval(checkInterval);
        console.error('Supabase客户端初始化超时，收藏功能不可用');
      }
    }, 100);
    return;
  }
  
  initFavoritesService(supabase);
  
  function initFavoritesService(supabase) {
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

        const { data, error } = await supabase
          .from('favorites')
          .insert({
            user_id: user.id,
            post_url: postUrl
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

        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('post_url', postUrl);

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

        const { data, error } = await supabase
          .from('favorites')
          .select('id')
          .eq('user_id', user.id)
          .eq('post_url', postUrl)
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
    async function getPostFavoriteCount(postUrl) {
      try {
        const { count, error } = await supabase
          .from('favorites')
          .select('*', { count: 'exact', head: true })
          .eq('post_url', postUrl);

        if (error) throw error;

        return { success: true, count: count || 0 };
      } catch (error) {
        console.error('获取收藏数失败:', error);
        return { success: false, error: error.message, count: 0 };
      }
    }

    // 批量获取多个文章的收藏数
    async function batchGetFavoriteCounts(postUrls) {
      try {
        // 规范化 URL
        const normalizeUrl = (url) => {
          if (!url) return '';
          let normalized = url;
          const baseurl = window.PC_BASEURL || '';
          if (baseurl && baseurl !== '/' && normalized.startsWith(baseurl)) {
            normalized = normalized.substring(baseurl.length);
          }
          if (!normalized.startsWith('/')) {
            normalized = '/' + normalized;
          }
          return normalized;
        };

        const normalizedUrls = postUrls.map(normalizeUrl).filter(url => url && url !== '/');
        
        if (normalizedUrls.length === 0) {
          return {};
        }

        // 查询这些 URL 的收藏数（使用聚合查询）
        const { data, error } = await supabase
          .from('favorites')
          .select('post_url')
          .in('post_url', normalizedUrls);

        if (error) throw error;

        // 统计每个 URL 的收藏数
        const countsMap = {};
        normalizedUrls.forEach(url => {
          countsMap[url] = 0;
        });

        if (data && Array.isArray(data)) {
          data.forEach(item => {
            const url = item.post_url;
            if (url in countsMap) {
              countsMap[url] = (countsMap[url] || 0) + 1;
            }
          });
        }

        // 同时构建原始 URL 到计数的映射
        const result = {};
        postUrls.forEach(originalUrl => {
          const normalized = normalizeUrl(originalUrl);
          result[originalUrl] = countsMap[normalized] || 0;
        });

        return result;
      } catch (error) {
        console.error('批量获取收藏数失败:', error);
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

        // 规范化URL，确保格式一致
        const normalizeUrl = (url) => {
          if (!url) return '';
          let normalized = url;
          // 移除baseurl
          const baseurl = window.PC_BASEURL || '';
          if (baseurl && baseurl !== '/' && normalized.startsWith(baseurl)) {
            normalized = normalized.substring(baseurl.length);
          }
          // 确保以/开头
          if (!normalized.startsWith('/')) {
            normalized = '/' + normalized;
          }
          return normalized;
        };

        // 规范化所有URL
        const normalizedUrls = postUrls.map(normalizeUrl).filter(url => url && url !== '/');
        if (normalizedUrls.length === 0) {
          return {};
        }

        // 构建URL映射，以便后续匹配
        const urlMap = {};
        postUrls.forEach((originalUrl, index) => {
          const normalized = normalizeUrl(originalUrl);
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

        if (error) throw error;

        // 构建一个Set，便于快速查找
        const favoritedSet = new Set((data || []).map(item => {
          const normalized = normalizeUrl(item.post_url);
          return normalized;
        }));
        
        const result = {};
        postUrls.forEach(url => {
          const normalized = normalizeUrl(url);
          result[url] = favoritedSet.has(normalized);
        });

        return result;
      } catch (error) {
        console.error('批量检查收藏状态失败:', error);
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

