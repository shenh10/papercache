// 点击统计和最多关注排序（服务器端）
(function() {
  'use strict';
  
  // 检测API地址：优先使用配置的API地址，否则使用当前域名
  function getApiBaseUrl() {
    // 尝试从页面配置中读取（如果Jekyll注入了）
    if (window.siteConfig && window.siteConfig.api_base_url) {
      return window.siteConfig.api_base_url;
    }
    // 尝试从meta标签读取
    const metaApi = document.querySelector('meta[name="api-base-url"]');
    if (metaApi) {
      return metaApi.getAttribute('content');
    }
    // 默认使用当前域名
    return window.location.origin;
  }
  
  const API_BASE_URL = getApiBaseUrl();
  const TRACK_CLICK_API = `${API_BASE_URL}/api/track-click`;
  const GET_CLICKS_API = `${API_BASE_URL}/api/get-clicks`;
  
  // 从服务器获取点击数据
  async function loadClickData() {
    try {
      const response = await fetch(GET_CLICKS_API);
      if (response.ok) {
        const data = await response.json();
        return data || {};
      } else {
        console.warn('Failed to load click data from server:', response.status);
        return {};
      }
    } catch (e) {
      console.warn('Error loading click data:', e);
      return {};
    }
  }
  
  // 记录文章点击到服务器
  async function trackClick(postUrl) {
    try {
      const response = await fetch(TRACK_CLICK_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ postUrl: postUrl })
      });
      
      if (response.ok) {
        const result = await response.json();
        // 重新加载数据以获取最新统计
        const clicks = await loadClickData();
        // 更新页面上的显示
        updateClickDisplay(postUrl, clicks[postUrl] || 0);
        return result;
      } else {
        console.warn('Failed to track click:', response.status);
      }
    } catch (e) {
      console.error('Error tracking click:', e);
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
  
  // 初始化：追踪所有文章链接的点击
  document.addEventListener('DOMContentLoaded', async function() {
    // 从服务器加载点击数据
    const clicks = await loadClickData();
    
    // 为所有文章链接添加点击追踪
    const postLinks = document.querySelectorAll('a.post-link[href*="/papers/"], a.post-link[href*="/slides/"]');
    postLinks.forEach(link => {
      link.addEventListener('click', function(e) {
        const url = this.getAttribute('href');
        // 异步追踪点击，不阻塞页面跳转
        trackClick(url).catch(err => {
          console.error('Failed to track click:', err);
        });
      });
    });
    
    // 更新并排序"最多关注"面板
    updatePopularPosts(clicks);
  });
  
  // 更新"最多关注"面板的显示和排序
  function updatePopularPosts(clicks) {
    const container = document.getElementById('popular-posts-list');
    if (!container) return;
    
    const items = Array.from(container.querySelectorAll('.post-item[data-post-url]'));
    
    // 更新点击数显示并过滤掉点击量为0的项目
    const validItems = [];
    items.forEach(item => {
      const url = item.getAttribute('data-post-url');
      const count = clicks[url] || 0;
      const dateEl = item.querySelector('.post-date-popular');
      if (dateEl) {
        dateEl.textContent = count;
      }
      
      // 只保留点击量大于0的项目
      if (count > 0) {
        validItems.push(item);
      } else {
        // 隐藏点击量为0的项目
        item.style.display = 'none';
      }
    });
    
    // 按点击量排序（降序）
    validItems.sort((a, b) => {
      const urlA = a.getAttribute('data-post-url');
      const urlB = b.getAttribute('data-post-url');
      const clicksA = clicks[urlA] || 0;
      const clicksB = clicks[urlB] || 0;
      
      // 如果点击量相同，按标题排序（保持一致性）
      if (clicksB === clicksA) {
        const titleA = a.getAttribute('data-post-title') || '';
        const titleB = b.getAttribute('data-post-title') || '';
        return titleA.localeCompare(titleB);
      }
      
      return clicksB - clicksA;
    });
    
    // 重新插入到容器中（保持表头在顶部）
    const header = container.querySelector('.post-list-header-popular');
    // 先移除所有有效项目
    validItems.forEach(item => {
      item.style.display = '';
      item.remove();
    });
    // 重新插入排序后的项目（只显示前10个）
    const topItems = validItems.slice(0, 10);
    topItems.forEach(item => {
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

