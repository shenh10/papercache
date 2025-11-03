// 点击统计和最多关注排序（使用 Supabase）
(function() {
  'use strict';
  
  // 规范化 URL
  function normalizeUrl(url) {
    if (!url) return '';
    try {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        const urlObj = new URL(url);
        return urlObj.pathname;
      }
    } catch (e) {
      // 忽略 URL 解析错误
    }
    if (!url.startsWith('/')) {
      url = '/' + url;
    }
    return url;
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
  
  // 从 Supabase 获取点击数据
  async function loadClickData() {
    const service = await waitForClickStatsService();
    if (!service) {
      console.warn('ClickTracker: clickStatsService not available');
      return {};
    }
    
    // 获取所有需要显示的文章 URL
    const container = document.getElementById('popular-posts-list');
    if (!container) {
      return {};
    }
    
    const items = Array.from(container.querySelectorAll('.post-item[data-post-url]'));
    const postUrls = items.map(item => {
      let url = item.getAttribute('data-post-url');
      return normalizeUrl(url);
    }).filter(url => url && url !== '/');
    
    if (postUrls.length === 0) {
      return {};
    }
    
    try {
      const clicksMap = await service.batchGetClickCounts(postUrls);
      return clicksMap;
    } catch (error) {
      console.error('ClickTracker: Failed to load click data', error);
      return {};
    }
  }
  
  // 记录文章点击到 Supabase
  async function trackClick(postUrl) {
    const normalizedUrl = normalizeUrl(postUrl);
    const service = await waitForClickStatsService();
    
    if (!service) {
      console.warn('ClickTracker: clickStatsService not available');
      return { success: false };
    }
    
    try {
      const result = await service.trackClick(normalizedUrl);
      
      if (result.success) {
        // 重新加载数据以获取最新统计
        const clicks = await loadClickData();
        // 更新页面上的显示
        const count = clicks[normalizedUrl] || result.clickCount || 0;
        updateClickDisplay(normalizedUrl, count);
        return result;
      } else {
        console.error('ClickTracker: Failed to track click', result.error);
        return result;
      }
    } catch (error) {
      console.error('ClickTracker: Error tracking click', error);
      return { success: false, error: error.message };
    }
  }
  
  // 更新页面上的点击数显示并重新排序
  async function updateClickDisplay(postUrl, count) {
    const items = document.querySelectorAll(`[data-post-url="${postUrl}"] .post-date-popular`);
    items.forEach(el => {
      el.textContent = count;
    });
    
    // 重新排序"最多关注"列表
    const clicks = await loadClickData();
    updatePopularPosts(clicks);
  }
  
  // 规范化 URL（确保相对路径和绝对路径一致）
  function normalizeUrl(url) {
    if (!url) return '';
    // 如果是完整 URL，提取路径部分
    try {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        const urlObj = new URL(url);
        return urlObj.pathname;
      }
    } catch (e) {
      // 忽略 URL 解析错误
    }
    // 确保以 / 开头
    if (!url.startsWith('/')) {
      url = '/' + url;
    }
    return url;
  }
  
  // 初始化函数
  async function initClickTracker() {
    // 从服务器加载点击数据
    const clicks = await loadClickData();
    
    // 为所有文章链接添加点击追踪（支持多种链接样式）
    // 1. .post-link 类（首页的"最多关注"列表）
    // 2. .post-card-link-modern 类（搜索和分类页面的卡片链接）
    // 3. 任何包含 /papers/ 或 /slides/ 的链接
    const postLinks = document.querySelectorAll(
      'a.post-link[href*="/papers/"], a.post-link[href*="/slides/"], ' +
      'a.post-card-link-modern[href*="/papers/"], a.post-card-link-modern[href*="/slides/"], ' +
      'a[href*="/papers/"][href*=".html"], a[href*="/slides/"][href*=".html"]'
    );
    
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
          return; // 跳过无效URL
        }
        
        // 异步追踪点击，不阻塞页面跳转
        trackClick(url).catch(err => {
          console.error('Failed to track click:', err);
        });
      }, { passive: true }); // 使用 passive 以提高性能
    });
    
    // 更新并排序"最多关注"面板
    updatePopularPosts(clicks);
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
  function updatePopularPosts(clicks) {
    const container = document.getElementById('popular-posts-list');
    if (!container) return;
    
    const items = Array.from(container.querySelectorAll('.post-item[data-post-url]'));
    
    // 更新点击数显示并过滤掉点击量为0的项目
    const validItems = [];
    items.forEach(item => {
      let url = item.getAttribute('data-post-url');
      // 规范化 URL 以确保匹配
      url = normalizeUrl(url);
      // 尝试多种 URL 格式进行匹配
      const count = clicks[url] || clicks[item.getAttribute('data-post-url')] || 0;
      const dateEl = item.querySelector('.post-date-popular');
      if (dateEl) {
        dateEl.textContent = count;
      }
      
      // 只保留点击量大于0的项目
      if (count > 0) {
        validItems.push({ item, count, url });
      } else {
        // 隐藏点击量为0的项目
        item.style.display = 'none';
      }
    });
    
    // 按点击量排序（降序）
    validItems.sort((a, b) => {
      // 如果点击量相同，按标题排序（保持一致性）
      if (b.count === a.count) {
        const titleA = a.item.getAttribute('data-post-title') || '';
        const titleB = b.item.getAttribute('data-post-title') || '';
        return titleA.localeCompare(titleB);
      }
      
      return b.count - a.count;
    });
    
    // 重新插入到容器中（保持表头在顶部）
    const header = container.querySelector('.post-list-header-popular');
    // 先移除所有有效项目
    validItems.forEach(({ item }) => {
      item.style.display = '';
      item.remove();
    });
    // 重新插入排序后的项目（只显示前10个）
    const topItems = validItems.slice(0, 10);
    topItems.forEach(({ item }) => {
      if (header) {
        header.after(item);
      } else {
        container.appendChild(item);
      }
    });
  }
  
  // 导出给其他脚本使用
  window.papercacheClickTracker = {
    trackClick,
    loadClickData,
    updatePopularPosts
  };
})();

