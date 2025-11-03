// 点击统计和最多关注排序（使用 Supabase）
(function() {
  'use strict';
  
  // 规范化 URL（与 favorites.js 保持一致，移除 baseurl 前缀）
  function normalizeUrl(url) {
    if (!url || typeof url !== 'string') return '';
    let normalized = url.trim();
    
    try {
      // 处理完整的URL
      if (url.startsWith('http://') || url.startsWith('https://')) {
        const urlObj = new URL(url);
        normalized = urlObj.pathname;
      }
    } catch (e) {
      // 忽略 URL 解析错误
    }
    
    // 移除baseurl前缀（如果存在）- 这是关键，确保与数据库存储格式一致
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
  }
  
  // 等待 clickStatsService 初始化
  async function waitForClickStatsService() {
    let attempts = 0;
    const maxAttempts = 50;
    
    while (attempts < maxAttempts && !window.clickStatsService) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    return window.clickStatsService || null;
  }
  
  // 等待 favoritesService 初始化
  async function waitForFavoritesService() {
    let attempts = 0;
    const maxAttempts = 50;
    
    while (attempts < maxAttempts && !window.favoritesService) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    return window.favoritesService || null;
  }
  
  // 从 Supabase 获取点击数据和收藏数据（高效方法：使用RPC函数）
  async function loadClickData() {
    const clickService = await waitForClickStatsService();
    
    // 优先使用高效的RPC函数直接获取排序后的Top N文章
    if (clickService && clickService.getTopPostsByEngagement) {
      try {
        // 获取Top N文章（按点击量+收藏量总和排序）
        // 注意：这里返回的数据结构是数组，包含 post_url, click_count, favorite_count, total_count
        const topPosts = await clickService.getTopPostsByEngagement(15); // 获取15个，前端再筛选前10个
        
        if (Array.isArray(topPosts) && topPosts.length > 0) {
          // 转换为 { clicks: {}, favorites: {} } 格式以兼容现有代码
          const clicksResult = {};
          const favoritesResult = {};
          // 保存排序顺序（URL数组），以便前端按此顺序排列
          const sortedUrls = [];
          
          topPosts.forEach(post => {
            const url = post.post_url;
            clicksResult[url] = post.click_count || 0;
            favoritesResult[url] = post.favorite_count || 0;
            sortedUrls.push(url);
          });
          
          // 同时构建URL映射，以支持原始URL（带baseurl）的查找
          const container = document.getElementById('popular-posts-list');
          if (container) {
            const items = Array.from(container.querySelectorAll('.post-item[data-post-url]'));
            items.forEach(item => {
              const originalUrl = item.getAttribute('data-post-url');
              if (originalUrl) {
                const normalized = normalizeUrl(originalUrl);
                // 如果原始URL不在结果中，但规范化URL在，则添加映射
                if (!(originalUrl in clicksResult) && normalized in clicksResult) {
                  clicksResult[originalUrl] = clicksResult[normalized];
                  favoritesResult[originalUrl] = favoritesResult[normalized];
                  // 如果规范化URL在排序列表中，也添加原始URL到排序列表（但保持原顺序）
                  const index = sortedUrls.indexOf(normalized);
                  if (index !== -1) {
                    sortedUrls.splice(index, 0, originalUrl);
                  }
                }
              }
            });
          }
          
          return { 
            clicks: clicksResult, 
            favorites: favoritesResult,
            sortedUrls: sortedUrls, // 标记这是来自RPC函数的排序结果
            fromRPC: true // 标记数据来源，便于前端优化
          };
        }
      } catch (error) {
        console.warn('ClickTracker: RPC方法失败，回退到批量查询方法', error);
        // 回退到旧方法
      }
    }
    
    // 回退方案：使用批量查询（旧方法）
    const favoriteService = await waitForFavoritesService();
    
    // 获取所有需要显示的文章 URL
    const container = document.getElementById('popular-posts-list');
    if (!container) {
      return { clicks: {}, favorites: {} };
    }
    
    const items = Array.from(container.querySelectorAll('.post-item[data-post-url]'));
    // 收集原始URL（传递给服务，让服务内部进行规范化）
    const originalUrls = items.map(item => item.getAttribute('data-post-url')).filter(url => url);
    
    if (originalUrls.length === 0) {
      return { clicks: {}, favorites: {} };
    }
    
    try {
      // 并行获取点击量和收藏量
      // 注意：传递给服务的应该是原始URL，服务内部会进行规范化
      // 但 clickStatsService.batchGetClickCounts 可能需要规范化URL，所以我们也传递规范化URL
      const normalizedUrls = originalUrls.map(url => normalizeUrl(url)).filter(url => url && url !== '/');
      const [clicksMap, favoritesMap] = await Promise.all([
        clickService ? clickService.batchGetClickCounts(normalizedUrls) : Promise.resolve({}),
        favoriteService ? favoriteService.batchGetFavoriteCounts(originalUrls) : Promise.resolve({})
      ]);
      
      // 将结果映射回原始URL（因为服务可能返回规范化URL作为键）
      const clicksResult = {};
      const favoritesResult = {};
      originalUrls.forEach(originalUrl => {
        const normalized = normalizeUrl(originalUrl);
        clicksResult[originalUrl] = clicksMap[normalized] || clicksMap[originalUrl] || 0;
        favoritesResult[originalUrl] = favoritesMap[originalUrl] || favoritesMap[normalized] || 0;
      });
      
      return { clicks: clicksResult, favorites: favoritesResult };
    } catch (error) {
      console.error('ClickTracker: Failed to load data', error);
      return { clicks: {}, favorites: {} };
    }
  }
  
  // 记录文章点击到 Supabase
  async function trackClick(postUrl) {
    const normalizedUrl = normalizeUrl(postUrl);
    const service = await waitForClickStatsService();
    
    if (!service) {
      console.warn('[ClickTracker] clickStatsService not available');
      return { success: false, error: 'Service not available' };
    }
    
    console.log('[ClickTracker] 开始追踪点击:', normalizedUrl);
    
    try {
      const result = await service.trackClick(normalizedUrl);
      
      if (result.success) {
        console.log('[ClickTracker] 点击追踪成功:', normalizedUrl, '点击量:', result.clickCount);
        // 重新加载数据以获取最新统计
        const data = await loadClickData();
        // 更新页面上的显示
        const clickCount = data.clicks[normalizedUrl] || result.clickCount || 0;
        updateClickDisplay(normalizedUrl, clickCount);
        return result;
      } else {
        console.error('[ClickTracker] 点击追踪失败:', result.error, 'URL:', normalizedUrl);
        return result;
      }
    } catch (error) {
      console.error('[ClickTracker] 点击追踪异常:', error, 'URL:', normalizedUrl);
      return { success: false, error: error.message };
    }
  }
  
  // 更新页面上的点击数显示并重新排序
  async function updateClickDisplay(postUrl, clickCount) {
    // 这里不需要单独更新显示，因为 updatePopularPosts 会统一更新
    // 重新排序"最多关注"列表
    const data = await loadClickData();
    updatePopularPosts(data);
  }
  
  
  // 初始化函数
  async function initClickTracker() {
    // 从服务器加载点击和收藏数据
    const data = await loadClickData();
    
    // 为所有文章链接添加点击追踪（支持多种链接样式）
    // 1. .post-link 类（首页的"最多关注"列表）
    // 2. .post-card-link-modern 类（搜索和分类页面的卡片链接）
    // 3. 任何包含 /papers/ 或 /slides/ 的链接
    // 4. 更通用的选择器：所有指向文章页面的链接
    const postLinks = document.querySelectorAll(
      'a.post-link[href*="/papers/"], a.post-link[href*="/slides/"], ' +
      'a.post-card-link-modern[href*="/papers/"], a.post-card-link-modern[href*="/slides/"], ' +
      'a[href*="/papers/"][href*=".html"], a[href*="/slides/"][href*=".html"], ' +
      'a[href*="/papers/"], a[href*="/slides/"]'
    );
    
    console.log(`[ClickTracker] 找到 ${postLinks.length} 个文章链接`);
    
    postLinks.forEach(link => {
      // 跳过已经绑定过追踪的链接
      if (link.dataset.clickTracked === 'true') {
        return;
      }
      
      // 标记为已追踪
      link.dataset.clickTracked = 'true';
      
      link.addEventListener('click', function(e) {
        let url = this.getAttribute('href') || this.href;
        if (!url || url === '#' || url.startsWith('javascript:')) {
          return; // 跳过无效链接
        }
        
        // 规范化 URL
        url = normalizeUrl(url);
        if (!url || url === '/') {
          console.warn('[ClickTracker] 跳过无效URL:', this.getAttribute('href'));
          return; // 跳过无效URL
        }
        
        console.log('[ClickTracker] 追踪点击:', url);
        
        // 异步追踪点击，不阻塞页面跳转
        // 注意：由于使用了 passive: true，无法阻止页面跳转
        // 但异步请求应该在跳转前完成，如果跳转太快可能丢失
        trackClick(url).catch(err => {
          console.error('[ClickTracker] Failed to track click:', err);
        });
      }, { passive: true }); // 使用 passive 以提高性能
    });
    
    // 更新并排序"最多关注"面板
    updatePopularPosts(data);
  }
  
  // DOMContentLoaded 时初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initClickTracker);
  } else {
    initClickTracker();
  }
  
  // Turbolinks 页面加载时也初始化
  document.addEventListener('turbolinks:load', initClickTracker);
  
  // 更新"最多关注"面板的显示和排序
  function updatePopularPosts(data) {
    const container = document.getElementById('popular-posts-list');
    if (!container) return;
    
    // data 可能是旧格式（只有 clicks 对象）或新格式（{ clicks: {}, favorites: {}, sortedUrls: [], fromRPC: true }）
    let clicks = {};
    let favorites = {};
    let sortedUrls = null;
    let fromRPC = false;
    
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      if (data.clicks && data.favorites) {
        // 新格式
        clicks = data.clicks || {};
        favorites = data.favorites || {};
        sortedUrls = data.sortedUrls || null;
        fromRPC = data.fromRPC || false;
      } else {
        // 旧格式（向后兼容）
        clicks = data || {};
        favorites = {};
        sortedUrls = null;
        fromRPC = false;
      }
    }
    
    const items = Array.from(container.querySelectorAll('.post-item[data-post-url]'));
    
    // 构建URL到item的映射，便于快速查找
    const urlToItemMap = new Map();
    items.forEach(item => {
      const originalUrl = item.getAttribute('data-post-url');
      if (originalUrl) {
        const normalized = normalizeUrl(originalUrl);
        urlToItemMap.set(originalUrl, item);
        urlToItemMap.set(normalized, item);
      }
    });
    
    // 更新显示并过滤掉点击量和收藏量都为0的项目
    const validItems = [];
    
    // 如果数据来自RPC函数且有排序列表，优先使用排序列表
    if (fromRPC && sortedUrls && Array.isArray(sortedUrls)) {
      sortedUrls.forEach(url => {
        const normalized = normalizeUrl(url);
        const item = urlToItemMap.get(url) || urlToItemMap.get(normalized);
        if (item) {
          const clickCount = clicks[url] || clicks[normalized] || 0;
          const favoriteCount = favorites[url] || favorites[normalized] || 0;
          const totalCount = clickCount + favoriteCount;
          
          const dateEl = item.querySelector('.post-date-popular');
          if (dateEl) {
            dateEl.textContent = `${clickCount}/${favoriteCount}`;
          }
          
          if (totalCount > 0) {
            validItems.push({ item, clickCount, favoriteCount, totalCount, url: normalized });
          } else {
            item.style.display = 'none';
          }
        }
      });
    } else {
      // 旧方法：遍历所有items
      items.forEach(item => {
        let url = item.getAttribute('data-post-url');
        const originalUrl = url;
        // 规范化 URL 以确保匹配
        url = normalizeUrl(url);
        
        // 获取点击量和收藏量
        const clickCount = clicks[url] || clicks[originalUrl] || 0;
        const favoriteCount = favorites[url] || favorites[originalUrl] || 0;
        const totalCount = clickCount + favoriteCount;
        
        const dateEl = item.querySelector('.post-date-popular');
        if (dateEl) {
          // 显示格式：点击量/收藏量
          dateEl.textContent = `${clickCount}/${favoriteCount}`;
        }
        
        // 只保留点击量和收藏量至少有一个大于0的项目
        if (totalCount > 0) {
          validItems.push({ item, clickCount, favoriteCount, totalCount, url });
        } else {
          // 隐藏点击量和收藏量都为0的项目
          item.style.display = 'none';
        }
      });
      
      // 按总排序（点击量+收藏量，降序）
      validItems.sort((a, b) => {
        // 首先按总排序
        if (b.totalCount !== a.totalCount) {
          return b.totalCount - a.totalCount;
        }
        // 如果总排序相同，优先按点击量排序
        if (b.clickCount !== a.clickCount) {
          return b.clickCount - a.clickCount;
        }
        // 如果点击量也相同，按标题排序（保持一致性）
        const titleA = a.item.getAttribute('data-post-title') || '';
        const titleB = b.item.getAttribute('data-post-title') || '';
        return titleA.localeCompare(titleB);
      });
    }
    
    // 重新插入到容器中（保持表头在顶部）
    const header = container.querySelector('.post-list-header-popular');
    
    // 先隐藏所有项目（包括那些totalCount为0的）
    items.forEach(item => {
      item.style.display = 'none';
      item.classList.add('popular-posts-loading');
    });
    
    // 先移除所有有效项目
    validItems.forEach(({ item }) => {
      item.remove();
    });
    
    // 重新插入排序后的项目（只显示前10个）
    const topItems = validItems.slice(0, 10);
    topItems.forEach(({ item }) => {
      // 移除loading类，显示项目
      item.classList.remove('popular-posts-loading');
      item.style.display = '';
      if (header) {
        header.after(item);
      } else {
        container.appendChild(item);
      }
    });
    
    // 如果没有任何有效项目，显示提示（可选）
    if (topItems.length === 0 && items.length > 0) {
      // 可以在这里添加一个"暂无数据"的提示，如果需要的话
    }
  }
  
  // 导出给其他脚本使用
  window.papercacheClickTracker = {
    trackClick,
    loadClickData,
    updatePopularPosts
  };
})();

