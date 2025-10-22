class PostPreviewLoader {
  constructor() {
    this.loadedPosts = new Map();
    this.hoverTimeout = null;
    this.hideTimeout = null;
    this.currentHoveredItem = null;
    this.activeFetchController = null;
    this.init();
  }

  init() {
    // 为所有文章项添加hover事件（改为 mouseover，便于使用 relatedTarget 判断）
    document.addEventListener('mouseover', (e) => {
      const postItem = e.target.closest('.post-item');
      if (postItem) {
        // 设置当前hover的项目
        this.currentHoveredItem = postItem;
        
        // 清除之前的延迟
        if (this.hoverTimeout) {
          clearTimeout(this.hoverTimeout);
        }
        if (this.hideTimeout) {
          clearTimeout(this.hideTimeout);
        }
        
        // 延迟300ms显示预览
        this.hoverTimeout = setTimeout(() => {
          this.handlePostHover(postItem);
        }, 300);
      }
    }, true);

    // 鼠标离开文章项时延迟隐藏预览（改为 mouseout，配合 relatedTarget 判断是否进入了预览面板）
    document.addEventListener('mouseout', (e) => {
      const postItem = e.target.closest('.post-item');
      if (postItem) {
        // 如果鼠标实际移动到了同一 postItem 内部的预览面板，则不处理隐藏
        const related = /** @type {HTMLElement|null} */ (e.relatedTarget);
        if (related && postItem.contains(related)) {
          return;
        }

        // 清除显示延迟
        if (this.hoverTimeout) {
          clearTimeout(this.hoverTimeout);
        }
        
        // 延迟200ms隐藏预览，给用户时间移动到预览窗口
        this.hideTimeout = setTimeout(() => {
          this.hidePreview(postItem);
        }, 200);
      }
    }, true);

    // 鼠标进入预览窗口时取消隐藏（mouseover 更灵敏）
    document.addEventListener('mouseover', (e) => {
      const previewContainer = e.target.closest('.post-preview');
      if (previewContainer) {
        console.log('鼠标进入预览窗口');
        // 取消隐藏延迟
        if (this.hideTimeout) {
          clearTimeout(this.hideTimeout);
        }
        // 设置当前hover的项目为预览窗口对应的文章项
        const postItem = previewContainer.closest('.post-item');
        if (postItem) {
          this.currentHoveredItem = postItem;
        }
      }
    }, true);

    // 鼠标离开预览窗口时延迟隐藏（mouseout 配合 relatedTarget 判断是否回到同一 postItem）
    document.addEventListener('mouseout', (e) => {
      const previewContainer = e.target.closest('.post-preview');
      if (previewContainer) {
        const postItem = previewContainer.closest('.post-item');
        if (postItem) {
          const related = /** @type {HTMLElement|null} */ (e.relatedTarget);
          // 如果鼠标回到 postItem 区域（包括标题等），则不隐藏
          if (related && postItem.contains(related)) {
            return;
          }
          // 延迟200ms隐藏，给用户时间移回文章项
          this.hideTimeout = setTimeout(() => {
            // 只有在不是当前hover的项目时才隐藏
            if (this.currentHoveredItem !== postItem) {
              this.hidePreview(postItem);
            }
          }, 200);
        }
      }
    }, true);
  }

  async handlePostHover(postItem) {
    const postUrl = postItem.dataset.postUrl;
    const postLink = postItem.querySelector('.post-link, .post-card-link, .post-card-link-modern');
    const postTitle = postLink ? postLink.dataset.postTitle : '';
    
    // 创建预览容器（如果不存在）
    let previewContainer = postItem.querySelector('.post-preview');
    if (!previewContainer) {
      previewContainer = document.createElement('div');
      previewContainer.className = 'post-preview';
      previewContainer.style.display = 'none';
      postItem.appendChild(previewContainer);
    }
    
    // 如果已经加载过，直接显示
    if (this.loadedPosts.has(postUrl)) {
      this.showPreview(previewContainer, this.loadedPosts.get(postUrl));
      return;
    }

    // 显示加载状态
    this.showLoadingState(previewContainer);

    try {
      // 取消上一次未完成的请求（如果存在）
      if (this.activeFetchController && typeof this.activeFetchController.abort === 'function') {
        this.activeFetchController.abort();
      }

      // 创建新的请求控制器
      this.activeFetchController = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      const signal = this.activeFetchController ? this.activeFetchController.signal : undefined;

      // 获取文章内容
      const response = await fetch(postUrl, { signal });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // 提取文章内容
      const postContent = doc.querySelector('.post-content');
      if (postContent) {
        // 提取"A1 主要贡献"章节内容
        const contributionSection = this.extractContributionSection(postContent);
        
        // 缓存内容
        this.loadedPosts.set(postUrl, {
          title: postTitle,
          contribution: contributionSection,
          fullContent: postContent.innerHTML,
          url: postUrl
        });

        // 显示预览
        this.showPreview(previewContainer, this.loadedPosts.get(postUrl));
      } else {
        throw new Error('Content not found');
      }

    } catch (error) {
      // 忽略主动取消导致的异常
      if (error && (error.name === 'AbortError' || error.message === 'The operation was aborted.')) {
        return;
      }
      console.error('Failed to load post:', error);
      this.showErrorState(previewContainer);
    }
  }

  hidePreview(postItem) {
    const previewContainer = postItem.querySelector('.post-preview');
    if (previewContainer) {
      previewContainer.style.display = 'none';
    }
    // 清理当前hover状态
    if (this.currentHoveredItem === postItem) {
      this.currentHoveredItem = null;
    }
  }

  extractContributionSection(postContent) {
    // 查找"A1 主要贡献"章节
    const headings = postContent.querySelectorAll('h1, h2, h3, h4, h5, h6');
    let contributionSection = null;
    
    for (let heading of headings) {
      const headingText = heading.textContent.trim();
      if (headingText.includes('A1') && headingText.includes('主要贡献')) {
        // 找到章节标题，提取后续内容
        let content = '';
        let nextElement = heading.nextElementSibling;
        
        // 提取直到下一个同级或更高级标题的内容
        while (nextElement && nextElement.tagName && !nextElement.tagName.match(/^H[1-6]$/)) {
          content += nextElement.textContent + ' ';
          nextElement = nextElement.nextElementSibling;
        }
        
        // 如果内容太长，截取前500个字符
        if (content.length > 500) {
          content = content.substring(0, 500) + '...';
        }
        
        contributionSection = content.trim();
        break;
      }
    }
    
    // 如果没有找到"A1 主要贡献"，尝试查找其他可能的贡献章节
    if (!contributionSection) {
      for (let heading of headings) {
        const headingText = heading.textContent.trim();
        if (headingText.includes('贡献') || headingText.includes('主要') || headingText.includes('创新')) {
          let content = '';
          let nextElement = heading.nextElementSibling;
          
          while (nextElement && nextElement.tagName && !nextElement.tagName.match(/^H[1-6]$/)) {
            content += nextElement.textContent + ' ';
            nextElement = nextElement.nextElementSibling;
          }
          
          if (content.length > 500) {
            content = content.substring(0, 500) + '...';
          }
          
          contributionSection = content.trim();
          break;
        }
      }
    }
    
    // 如果还是没找到，返回文章开头的内容
    if (!contributionSection) {
      const allText = postContent.textContent;
      contributionSection = allText.substring(0, 300) + '...';
    }
    
    return contributionSection;
  }

  showLoadingState(previewContainer) {
    previewContainer.style.display = 'block';
    previewContainer.innerHTML = `
      <div class="preview-content">
        <div class="preview-loading">⏳ 加载中...</div>
      </div>
    `;
  }

  showPreview(previewContainer, postData) {
    previewContainer.innerHTML = `
      <div class="preview-content">
        <div class="preview-header">
          <h4 class="preview-title">${postData.title}</h4>
        </div>
        <div class="preview-section">
          <h5 class="section-title">📋 主要贡献</h5>
          <div class="preview-contribution">
            ${postData.contribution}
          </div>
        </div>
        <div class="preview-footer">
          <a href="${postData.url}" class="read-full-btn">📖 阅读完整内容</a>
        </div>
      </div>
    `;
    previewContainer.style.display = 'block';
  }

  showErrorState(previewContainer) {
    previewContainer.innerHTML = `
      <div class="preview-content">
        <div class="preview-error">
          <p>❌ 加载失败</p>
          <button onclick="location.reload()" class="retry-btn">重试</button>
        </div>
      </div>
    `;
  }
}

// 初始化预览加载器
document.addEventListener('DOMContentLoaded', function() {
  window.postPreviewLoader = new PostPreviewLoader();
});

