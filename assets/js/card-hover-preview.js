console.log('🎯 card-hover-preview.js 脚本已加载');

document.addEventListener('DOMContentLoaded', () => {
  // 跳过演示文稿页面
  if (document.body.hasAttribute('data-slides-page') || 
      document.querySelector('.collection-page') && window.location.pathname.includes('/slides')) {
    console.log('📄 演示文稿页面，跳过 hover 预览效果');
    return;
  }
  
  console.log('📄 DOM 已加载，开始设置 hover 预览');
  
  // 排除演示文稿页面的卡片
  const cards = Array.from(document.querySelectorAll('.post-item.post-card, .post-item.post-card-modern'))
    .filter(card => {
      // 跳过演示文稿页面的卡片
      if (card.closest('.collection-page')) {
        return false;
      }
      return card.querySelector('.post-card-link, .post-card-link-modern');
    });
  
  console.log(`🔍 找到 ${cards.length} 个文章卡片，开始设置 hover 效果`);
  
  // 创建全局预览容器
  const previewContainer = document.createElement('div');
  previewContainer.className = 'card-hover-preview';
  previewContainer.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 9999;
    display: none;
  `;
  document.body.appendChild(previewContainer);
  
  // 创建预览内容容器
  const previewContent = document.createElement('div');
  previewContent.className = 'card-hover-preview-content';
  previewContent.style.cssText = `
    position: absolute;
    background: white;
    border-radius: 12px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
    border: 1px solid rgba(0, 0, 0, 0.1);
    padding: 20px;
    max-width: 400px;
    min-width: 300px;
    pointer-events: auto;
    opacity: 0;
    transform: translateY(10px);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.6;
  `;
  previewContainer.appendChild(previewContent);
  
  let currentCard = null;
  let hoverTimeout = null;
  let hideTimeout = null;
  
  // 为每个卡片添加 hover 事件
  cards.forEach(card => {
    const link = card.querySelector('.post-card-link, .post-card-link-modern');
    if (!link) return;
    
    const postUrl = link.getAttribute('href');
    const postTitle = link.getAttribute('data-post-title') || link.textContent.trim();
    
    // 鼠标进入卡片
    card.addEventListener('mouseenter', (e) => {
      if (hoverTimeout) clearTimeout(hoverTimeout);
      if (hideTimeout) clearTimeout(hideTimeout);
      
      currentCard = card;
      hoverTimeout = setTimeout(() => {
        showPreview(card, postUrl, postTitle);
      }, 300); // 300ms 延迟显示
    });
    
    // 鼠标离开卡片
    card.addEventListener('mouseleave', (e) => {
      if (hoverTimeout) clearTimeout(hoverTimeout);
      
      hideTimeout = setTimeout(() => {
        hidePreview();
      }, 200); // 200ms 延迟隐藏
    });
  });
  
  // 鼠标进入预览容器时取消隐藏
  previewContainer.addEventListener('mouseenter', () => {
    if (hideTimeout) clearTimeout(hideTimeout);
  });
  
  // 鼠标离开预览容器时隐藏
  previewContainer.addEventListener('mouseleave', () => {
    hideTimeout = setTimeout(() => {
      hidePreview();
    }, 200);
  });
  
  async function showPreview(card, postUrl, postTitle) {
    if (!currentCard || currentCard !== card) return;
    
    try {
      console.log('🔍 开始获取文章内容:', postUrl);
      
      // 显示加载状态
      previewContent.innerHTML = `
        <div style="text-align: center; padding: 20px;">
          <div style="width: 20px; height: 20px; border: 2px solid #3b82f6; border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 10px;"></div>
          <div style="color: #666; font-size: 14px;">正在加载文章内容...</div>
        </div>
        <style>
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      `;
      
      // 定位预览容器
      positionPreview(card);
      previewContainer.style.display = 'block';
      
      // 获取文章内容
      const html = await fetch(postUrl, { credentials: 'same-origin' }).then(r => r.text());
      const doc = new DOMParser().parseFromString(html, 'text/html');
      
      // 提取文章内容
      const content = extractArticleContent(doc);
      
      if (content) {
        previewContent.innerHTML = `
          <div style="margin-bottom: 15px;">
            <div style="color: #4a5568; font-size: 14px; line-height: 1.6;">${content}</div>
          </div>
          <div style="text-align: center; margin-top: 15px;">
            <a href="${postUrl}" style="color: #3b82f6; text-decoration: none; font-size: 14px; font-weight: 500;">查看完整文章 →</a>
          </div>
        `;
      } else {
        previewContent.innerHTML = `
          <div style="text-align: center; padding: 20px;">
            <div style="color: #666; font-size: 14px;">无法加载文章内容</div>
          </div>
        `;
      }
      
      // 显示动画
      requestAnimationFrame(() => {
        previewContent.style.opacity = '1';
        previewContent.style.transform = 'translateY(0)';
      });
      
    } catch (error) {
      console.error('获取文章内容失败:', error);
      previewContent.innerHTML = `
        <div style="text-align: center; padding: 20px;">
          <div style="color: #e53e3e; font-size: 14px;">加载失败，请稍后重试</div>
        </div>
      `;
    }
  }
  
  function hidePreview() {
    previewContent.style.opacity = '0';
    previewContent.style.transform = 'translateY(10px)';
    
    setTimeout(() => {
      previewContainer.style.display = 'none';
      currentCard = null;
    }, 300);
  }
  
  function positionPreview(card) {
    const rect = card.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let left = rect.right + 20;
    let top = rect.top;
    
    // 如果右边空间不够，显示在左边
    if (left + 400 > viewportWidth) {
      left = rect.left - 420;
    }
    
    // 如果左边空间也不够，居中显示
    if (left < 20) {
      left = (viewportWidth - 400) / 2;
    }
    
    // 调整垂直位置
    if (top + 200 > viewportHeight) {
      top = viewportHeight - 220;
    }
    if (top < 20) {
      top = 20;
    }
    
    previewContainer.style.left = left + 'px';
    previewContainer.style.top = top + 'px';
  }
  
  function extractArticleContent(doc) {
    const postContent = doc.querySelector('.post-content');
    if (!postContent) return null;
    
    // 优先提取 A1 主要贡献段落
    const headingNodes = Array.from(postContent.querySelectorAll('h1,h2,h3,h4,h5,h6'));
    const a1 = headingNodes.find(h => /A1\s*主要贡献/.test(h.textContent.trim()));
    
    if (a1) {
      // 找到 A1 后的前几个段落
      let content = '';
      let cur = a1.nextElementSibling;
      let paragraphCount = 0;
      
      while (cur && paragraphCount < 3) {
        if (cur.tagName === 'P') {
          const text = cur.textContent.trim();
          if (text && text.length > 20) {
            content += `<p style="margin: 0 0 10px 0;">${text}</p>`;
            paragraphCount++;
          }
        } else if (cur.tagName === 'UL' || cur.tagName === 'OL') {
          const items = cur.querySelectorAll('li');
          if (items.length > 0) {
            content += `<ul style="margin: 0 0 10px 0; padding-left: 20px;">`;
            for (let i = 0; i < Math.min(items.length, 3); i++) {
              const text = items[i].textContent.trim();
              if (text) {
                content += `<li style="margin: 0 0 5px 0;">${text}</li>`;
              }
            }
            content += `</ul>`;
            paragraphCount++;
          }
        }
        cur = cur.nextElementSibling;
      }
      
      if (content) {
        return content;
      }
    }
    
    // 如果没有找到 A1 段落，提取前几个段落
    const paragraphs = Array.from(postContent.querySelectorAll('p'))
      .map(p => p.textContent.trim())
      .filter(text => text && text.length > 30)
      .slice(0, 2);
    
    if (paragraphs.length > 0) {
      return paragraphs.map(p => `<p style="margin: 0 0 10px 0;">${p}</p>`).join('');
    }
    
    return null;
  }
  
  // 监听滚动，隐藏预览
  window.addEventListener('scroll', () => {
    if (currentCard) {
      hidePreview();
    }
  });
  
  console.log('✅ Hover 预览效果设置完成');
});
