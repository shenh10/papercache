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
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            // 没有找到记录
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

        const { data, error } = await supabase
          .from('favorites')
          .select('post_url')
          .eq('user_id', user.id)
          .in('post_url', postUrls);

        if (error) throw error;

        // 构建一个Set，便于快速查找
        const favoritedSet = new Set((data || []).map(item => item.post_url));
        const result = {};
        postUrls.forEach(url => {
          result[url] = favoritedSet.has(url);
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
      batchCheckFavorites
    };
  }
})();

