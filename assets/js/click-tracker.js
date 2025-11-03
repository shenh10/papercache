// 点击统计和最多关注排序（使用 Supabase + 现代批处理）
(function() {
  'use strict';
  
  // 配置 - 现代批处理参数
  const BATCH_CONFIG = {
    BATCH_SIZE: 10,           // 批量处理大小
    FLUSH_INTERVAL: 5000,    // 5秒刷新一次
    MAX_RETRY: 3,            // 最大重试次数
    STORAGE_KEY: 'pc_click_queue', // localStorage key
  };
  
  // 点击队列
  let clickQueue = [];
  let flushTimer = null;
  let isFlushing = false;
  
  // 从 localStorage 恢复队列（防止刷新丢失）
  function loadQueue() {
    try {
      const stored = localStorage.getItem(BATCH_CONFIG.STORAGE_KEY);
      if (stored) {
        clickQueue = JSON.parse(stored) || [];
        if (clickQueue.length > 0) {
          console.log('[ClickTracker] 恢复队列，待处理:', clickQueue.length);
          scheduleFlush(); // 恢复后立即调度刷新
        }
      }
    } catch (e) {
      console.warn('[ClickTracker] 恢复队列失败:', e);
      clickQueue = [];
    }
  }
  
  // 保存队列到 localStorage
  function saveQueue() {
    try {
      localStorage.setItem(BATCH_CONFIG.STORAGE_KEY, JSON.stringify(clickQueue));
    } catch (e) {
      console.warn('[ClickTracker] 保存队列失败:', e);
    }
  }
  
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
  
  // 调度刷新
  function scheduleFlush() {
    if (flushTimer) return;
    
    flushTimer = setTimeout(() => {
      flushTimer = null;
      flushQueue();
    }, BATCH_CONFIG.FLUSH_INTERVAL);
  }
  
  // 批量刷新队列到 Supabase
  async function flushQueue() {
    if (isFlushing || clickQueue.length === 0) return;
    
    isFlushing = true;
    const batch = clickQueue.splice(0, BATCH_CONFIG.BATCH_SIZE);
    saveQueue(); // 立即保存剩余队列
    
    console.log('[ClickTracker] 开始批量刷新，数量:', batch.length);
    
    try {
      // 等待服务可用
      const service = await waitForClickStatsService();
      
      if (!service) {
        console.warn('[ClickTracker] 服务不可用，重新加入队列');
        clickQueue.unshift(...batch); // 重新加入队列
        saveQueue();
        isFlushing = false;
        return;
      }
      
      // 统计每个 URL 的点击次数（去重并聚合）
      const urlCounts = {};
      batch.forEach(item => {
        urlCounts[item.url] = (urlCounts[item.url] || 0) + 1;
      });
      
      // 批量发送（并行处理多个 URL）
      const promises = Object.entries(urlCounts).map(([url, count]) => 
        incrementClickMultiple(service, url, count)
      );
      
      const results = await Promise.allSettled(promises);
      
      // 检查失败的项目并重新加入队列（重试）
      const failed = [];
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          const url = Object.keys(urlCounts)[index];
          failed.push(url);
          console.error('[ClickTracker] 批量刷新失败:', url, result.reason);
        }
      });
      
      if (failed.length > 0) {
        // 重试失败的项目（最多重试3次）
        batch.forEach(item => {
          if (failed.includes(item.url) && item.retryCount < BATCH_CONFIG.MAX_RETRY) {
            item.retryCount++;
            clickQueue.push(item);
          }
        });
        saveQueue();
      }
      
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      console.log('[ClickTracker] 批量刷新完成，成功:', successCount, '失败:', failed.length);
      
      // 如果成功刷新了，更新显示（仅当在首页时）
      if (successCount > 0 && document.getElementById('popular-posts-list')) {
        const data = await loadClickData();
        updatePopularPosts(data);
      }
      
    } catch (error) {
      console.error('[ClickTracker] 批量刷新异常:', error);
      // 异常时重新加入队列
      clickQueue.unshift(...batch);
      saveQueue();
    } finally {
      isFlushing = false;
      
      // 如果还有待处理的，继续调度
      if (clickQueue.length > 0) {
        scheduleFlush();
      }
    }
  }
  
  // 多次增加点击量（针对同一个 URL 多次点击的情况）
  async function incrementClickMultiple(service, url, count) {
    // 直接调用服务多次
    for (let i = 0; i < count; i++) {
      const result = await service.trackClick(url);
      if (!result.success) {
        throw new Error(result.error || 'Track failed');
      }
    }
    return { success: true };
  }
  
  // 使用 sendBeacon 发送（页面卸载时）
  function sendBeaconClick(postUrl) {
    const normalizedUrl = normalizeUrl(postUrl);
    if (!normalizedUrl || normalizedUrl === '/') return false;
    
    try {
      // 尝试使用 fetch with keepalive（比 sendBeacon 更灵活）
      const supabaseUrl = window.getSupabaseClient?.()?._url || '';
      if (!supabaseUrl) return false;
      
      const endpoint = `${supabaseUrl}/rest/v1/rpc/increment_post_click`;
      const supabaseKey = window.getSupabaseClient?.()?._anonKey || '';
      
      fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({ p_url: normalizedUrl }),
        keepalive: true
      }).catch(err => {
        console.warn('[ClickTracker] sendBeacon fallback failed:', err);
        // Fallback: 保存到队列
        enqueueClick(normalizedUrl);
      });
      
      return true;
    } catch (e) {
      console.warn('[ClickTracker] sendBeacon failed:', e);
      return false;
    }
  }
  
  // 添加到队列（现代批处理方式）
  function enqueueClick(postUrl) {
    const normalizedUrl = normalizeUrl(postUrl);
    if (!normalizedUrl || normalizedUrl === '/') {
      console.warn('[ClickTracker] 跳过无效URL:', postUrl);
      return;
    }
    
    // 添加到队列
    clickQueue.push({
      url: normalizedUrl,
      timestamp: Date.now(),
      retryCount: 0
    });
    
    saveQueue();
    
    // 如果队列达到批次大小，立即刷新
    if (clickQueue.length >= BATCH_CONFIG.BATCH_SIZE) {
      flushQueue();
    } else {
      // 否则设置定时器
      scheduleFlush();
    }
    
    console.log('[ClickTracker] 点击已加入队列:', normalizedUrl, '队列长度:', clickQueue.length);
  }
  
  // 记录文章点击（现代批处理版本 - 使用队列）
  function trackClick(postUrl) {
    // 直接加入队列，由批处理系统统一处理
    enqueueClick(postUrl);
    return { success: true, queued: true };
  }
  
  // 检查当前页面是否应该启用点击追踪
  function shouldTrackClicksOnThisPage() {
    const pathname = window.location.pathname || '';
    
    // 处理 baseurl - 直接移除，不经过 normalizeUrl（避免过度处理）
    const baseurl = window.PC_BASEURL || '';
    let checkPath = pathname;
    if (baseurl && baseurl !== '/' && baseurl !== '') {
      const normalizedBase = baseurl.endsWith('/') ? baseurl.slice(0, -1) : baseurl;
      if (checkPath.startsWith(normalizedBase)) {
        checkPath = checkPath.substring(normalizedBase.length);
      }
    }
    
    // 确保以 / 开头
    if (!checkPath.startsWith('/')) {
      checkPath = '/' + checkPath;
    }
    
    // 排除个人账户相关页面（不追踪这些页面的点击）
    if (checkPath.startsWith('/account/') || 
        checkPath.startsWith('/profile/') || 
        checkPath.startsWith('/auth/') ||
        checkPath === '/account' ||
        checkPath === '/profile' ||
        checkPath === '/auth') {
      return false;
    }
    
    // 排除已经是文章页面本身（用户已经在目标页面了，不需要追踪）
    // 文章页面格式：/papers/.../.../YYYY/MM/DD/title.html 或 /slides/.../.../title.html
    // 注意：collection.html、index.html 等非文章页面应该允许追踪
    if (checkPath.includes('.html')) {
      // 只有以 /papers/ 或 /slides/ 开头的 .html 页面才是文章页面
      if (checkPath.startsWith('/papers/') || checkPath.startsWith('/slides/')) {
        return false;  // 文章页面本身不追踪点击（用户已经在阅读了）
      }
      // 其他 .html 页面（如 /collection.html, /index.html）应该允许追踪
    }
    
    // 允许追踪的页面：
    // 1. 首页（/ 或 /index.html）
    // 2. 搜索结果页面（/collection.html）
    // 3. 分类浏览页面（但不包括文章页面）
    // 4. 其他非账户、非文章页面
    return true;
  }

  // 初始化函数
  async function initClickTracker() {
    // 恢复队列（如果有）
    loadQueue();
    
    // 检查是否应该在这个页面启用点击追踪
    if (!shouldTrackClicksOnThisPage()) {
      console.log('[ClickTracker] 当前页面不需要点击追踪，跳过初始化');
      return;
    }
    
    // 页面可见性变化时刷新
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && clickQueue.length > 0) {
        flushQueue();
      }
    });
    
    // 页面卸载前尝试发送剩余的点击
    window.addEventListener('beforeunload', () => {
      if (clickQueue.length > 0) {
        // 尝试使用 keepalive 发送
        clickQueue.forEach(item => {
          sendBeaconClick(item.url);
        });
      }
    });
    // 从服务器加载点击和收藏数据
    const data = await loadClickData();
    
    // 为所有文章链接添加点击追踪（只追踪文章页面，不追踪分类页面）
    // 选择器策略：只选择有特定类名或明确指向.html文章的链接
    const postLinks = document.querySelectorAll(
      'a.post-link[href*="/papers/"], a.post-link[href*="/slides/"], ' +
      'a.post-card-link-modern[href*="/papers/"], a.post-card-link-modern[href*="/slides/"], ' +
      'a[href*="/papers/"][href*=".html"], a[href*="/slides/"][href*=".html"]'
    );
    
    // 过滤掉分类页面链接（不包含.html的URL）
    const validPostLinks = Array.from(postLinks).filter(link => {
      const href = link.getAttribute('href') || link.href || '';
      // 必须包含 .html 或者是明确的文章链接格式
      // 排除分类页面（如 /papers/llm/, /papers/algorithm/）
      const normalizedHref = normalizeUrl(href);
      
      // 检查是否是文章URL（必须包含.html或匹配文章路径模式）
      // 文章URL格式：/papers/category/subcategory/YYYY/MM/DD/title.html
      // 或：/papers/category/title.html
      // 分类URL格式：/papers/category/ 或 /papers/category/subcategory/
      const isArticleUrl = normalizedHref.includes('.html') || 
                          /^\/papers\/[^/]+\/[^/]+\/\d{4}\/\d{2}\/\d{2}\//.test(normalizedHref) ||
                          /^\/slides\/[^/]+\/[^/]+\/\d{4}\/\d{2}\/\d{2}\//.test(normalizedHref);
      
      // 排除分类页面（以斜杠结尾，且不是根路径）
      const isCategoryPage = normalizedHref.match(/^\/papers\/[^/]+\/?$/) || 
                            normalizedHref.match(/^\/papers\/[^/]+\/[^/]+\/?$/) ||
                            normalizedHref.match(/^\/slides\/[^/]+\/?$/) ||
                            normalizedHref.match(/^\/slides\/[^/]+\/[^/]+\/?$/);
      
      return isArticleUrl && !isCategoryPage;
    });
    
    console.log(`[ClickTracker] 找到 ${validPostLinks.length} 个文章链接（已过滤分类链接）`);
    
    validPostLinks.forEach(link => {
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
          return; // 跳过无效URL（不再输出警告，减少日志）
        }
        
        // 再次验证是否是文章URL（双重检查）
        const isArticleUrl = url.includes('.html') || 
                            /^\/papers\/[^/]+\/[^/]+\/\d{4}\/\d{2}\/\d{2}\//.test(url) ||
                            /^\/slides\/[^/]+\/[^/]+\/\d{4}\/\d{2}\/\d{2}\//.test(url);
        
        const isCategoryPage = url.match(/^\/papers\/[^/]+\/?$/) || 
                              url.match(/^\/papers\/[^/]+\/[^/]+\/?$/) ||
                              url.match(/^\/slides\/[^/]+\/?$/) ||
                              url.match(/^\/slides\/[^/]+\/[^/]+\/?$/);
        
        if (!isArticleUrl || isCategoryPage) {
          return; // 跳过分类页面和其他非文章链接
        }
        
        console.log('[ClickTracker] 追踪点击:', url);
        
        // 使用现代批处理方式：加入队列（不阻塞页面跳转）
        trackClick(url);
        
        // 如果页面即将跳转，尝试立即发送（使用 keepalive）
        // 这可以确保在快速跳转时也能记录点击
        if (document.visibilityState === 'hidden' || !document.hasFocus()) {
          sendBeaconClick(url);
        }
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
    updatePopularPosts,
    flushQueue,  // 暴露刷新函数，允许手动触发
    getQueueSize: () => clickQueue.length  // 获取队列大小（用于调试）
  };
})();

