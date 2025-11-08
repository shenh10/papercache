console.log('🚀 card-enhancements.js 脚本已加载');

// 全局摘要映射和缩略图映射
let excerptsMapping = null;
let thumbnailsMapping = null;

// 收藏按钮重试计数器（全局变量，用于跨页面重置）
let favoriteButtonRetryCount = 0;
const MAX_FAVORITE_BUTTON_RETRIES = 5; // 最多重试5次（1秒）

// 防抖机制：避免短时间内重复调用收藏状态检查
let favoriteCheckDebounceTimer = null;
let lastFavoriteCheckTime = 0;
const FAVORITE_CHECK_DEBOUNCE_MS = 2000; // 2秒内只执行一次
let authChangeListenerRegistered = false; // 标记是否已注册认证状态监听器

// 初始化函数
async function initCardEnhancements() {
  // 首先检查是否是演示文稿页面（不需要收藏按钮）
  const isSlidesPage = document.body.hasAttribute('data-slides-page') || 
                      window.location.pathname.includes('/slides') ||
                      (document.querySelector('.collection-page') && window.location.pathname.includes('/slides'));
  
  if (isSlidesPage) {
    console.log('📄 演示文稿页面，跳过卡片增强功能');
    return;
  }
  
  console.log('📄 DOM 已加载，开始处理卡片');
  
  // 尝试加载预生成的摘要映射和缩略图映射
  // 使用相对路径，兼容本地开发和生产环境
  const baseurl = window.PC_BASEURL || '';
  const excerptsPath = baseurl ? `${baseurl}/assets/data/excerpts.json` : '/assets/data/excerpts.json';
  const thumbnailsPath = baseurl ? `${baseurl}/assets/data/thumbnails_by_path.yml` : '/assets/data/thumbnails_by_path.yml';
  
  try {
    const [excerptsResponse, thumbnailsResponse] = await Promise.all([
      fetch(excerptsPath),
      fetch(thumbnailsPath)
    ]);
    
    if (excerptsResponse.ok) {
      excerptsMapping = await excerptsResponse.json();
      const excerptCount = Object.keys(excerptsMapping).length;
      console.log('✅ 预生成摘要映射加载成功，包含', excerptCount, '个文章');
      if (excerptCount > 0) {
        const sampleKeys = Object.keys(excerptsMapping).slice(0, 3);
        console.log('🔍 摘要映射示例键:', sampleKeys);
      }
    } else {
      console.log('⚠️ 预生成摘要映射不存在或加载失败 (状态码:', excerptsResponse.status, ')，将使用动态生成');
      console.log('🔍 尝试加载的路径:', excerptsPath);
      excerptsMapping = {};
    }
    
    if (thumbnailsResponse.ok) {
      const yamlText = await thumbnailsResponse.text();
      // 改进的YAML解析（处理复杂格式）
      thumbnailsMapping = {};
      const lines = yamlText.split('\n');
      let currentKey = '';
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // 处理以 ? 开头的键
        if (line.startsWith('?')) {
          currentKey = line.substring(1).trim();
        }
        // 处理以 : 开头的值
        else if (line.startsWith(':') && currentKey) {
          const value = line.substring(1).trim();
          if (value) {
            thumbnailsMapping[currentKey] = value;
          }
          currentKey = '';
        }
        // 处理普通键值对
        else if (line.includes(': ') && !line.startsWith('?') && !line.startsWith(':')) {
          const [key, value] = line.split(': ', 2);
          if (key && value) {
            thumbnailsMapping[key.trim()] = value.trim();
          }
        }
      }
      const thumbCount = Object.keys(thumbnailsMapping).length;
      console.log('✅ 预生成缩略图映射加载成功，包含', thumbCount, '个缩略图');
      // 调试：显示前几个映射条目
      if (thumbCount > 0) {
        const sampleKeys = Object.keys(thumbnailsMapping).slice(0, 3);
        console.log('🔍 缩略图映射示例:', sampleKeys.map(key => `${key} -> ${thumbnailsMapping[key]}`));
      }
    } else {
      console.log('⚠️ 预生成缩略图映射不存在或加载失败 (状态码:', thumbnailsResponse.status, ')，将使用动态生成');
      console.log('🔍 尝试加载的路径:', thumbnailsPath);
      thumbnailsMapping = {};
    }
  } catch (error) {
    console.log('⚠️ 预生成映射加载失败，将使用动态生成');
    excerptsMapping = {};
    thumbnailsMapping = {};
  }
  
  const cards = Array.from(document.querySelectorAll('.post-item.post-card, .post-item.post-card-modern'))
    .filter(card => card.querySelector('.post-card-link, .post-card-link-modern'));
  
  console.log(`🔍 找到 ${cards.length} 个文章卡片`);

  // 统计预生成内容使用情况
  let pregenExcerptCount = 0;
  let pregenThumbCount = 0;
  let dynamicCount = 0;

  // 仅在需要时才抓取：无缩略图或无摘要才排队
  function needsEnhance(card) {
    const hasThumb = !!card.querySelector('.post-card-thumb img, .post-card-thumb-modern img');
    const hasExcerpt = !!card.querySelector('.post-card-excerpt, .post-card-excerpt-modern');
    // 如果没有摘要，就需要增强
    return !hasExcerpt;
  }

  // 简易并发限制队列，避免一次性抓取过多页面
  const MAX_CONCURRENCY = 4; // 增加并发数
  const MAX_CARDS_TO_PROCESS = 100; // 限制处理的卡片数量，避免性能问题
  let running = 0;
  let processedCount = 0;
  const queue = [];

  function schedule(task) {
    queue.push(task);
    pump();
  }

  function pump() {
    while (running < MAX_CONCURRENCY && queue.length > 0) {
      const t = queue.shift();
      running++;
      Promise.resolve()
        .then(t)
        .catch(() => {})
        .finally(() => { running--; pump(); });
    }
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const card = e.target;
        if (needsEnhance(card)) {
          processedCount++;
          schedule(() => enhanceCard(card));
        }
        io.unobserve(card);
      }
    });
  }, { rootMargin: '200px' });

  // 立即处理有预生成内容的卡片
  cards.forEach(card => {
    const linkEl = card.querySelector('.post-card-link, .post-card-link-modern');
    if (!linkEl) return;
    
    const postUrl = linkEl.getAttribute('href');
    // 规范化 URL：去掉 baseurl 前缀（如果存在）
    let lookupUrl = postUrl;
    const baseurl = window.PC_BASEURL || '';
    if (baseurl && baseurl !== '/' && postUrl.startsWith(baseurl)) {
      lookupUrl = postUrl.substring(baseurl.length);
    } else if (postUrl.startsWith('/papercache/')) {
      lookupUrl = postUrl.replace('/papercache', '');
    }
    // 确保 lookupUrl 以 / 开头
    if (!lookupUrl.startsWith('/')) {
      lookupUrl = '/' + lookupUrl;
    }
    
    const hasPregenThumb = thumbnailsMapping && thumbnailsMapping[lookupUrl];
    const hasPregenExcerpt = excerptsMapping && excerptsMapping[lookupUrl];
    
    // 如果有预生成内容，立即处理
    if (hasPregenThumb || hasPregenExcerpt) {
      if (needsEnhance(card) && processedCount < MAX_CARDS_TO_PROCESS) {
        processedCount++;
        schedule(() => enhanceCard(card));
      }
    } else {
      // 没有预生成内容的卡片，使用IntersectionObserver延迟处理
      io.observe(card);
    }
  });
  
  // 批量预加载更多卡片（分批处理，避免阻塞）
  setTimeout(() => {
    const remainingCards = cards.filter(card => !card.dataset.enhanced);
    const batchSize = 10;
    const batches = [];
    
    for (let i = 0; i < remainingCards.length; i += batchSize) {
      batches.push(remainingCards.slice(i, i + batchSize));
    }
    
    batches.forEach((batch, index) => {
      setTimeout(() => {
        batch.forEach(card => {
          if (needsEnhance(card)) {
            processedCount++;
            schedule(() => enhanceCard(card));
          }
        });
      }, index * 100); // 每批间隔100ms
    });
  }, 1000);
  
  // 显示统计信息
  setTimeout(() => {
    console.log(`📊 内容统计: 预生成摘要 ${pregenExcerptCount} 个, 预生成缩略图 ${pregenThumbCount} 个, 动态生成 ${dynamicCount} 个`);
  }, 3000);

  // 批量检查收藏状态（已登录用户）- 带防抖的包装函数
  function debouncedBatchCheckFavorites() {
    const now = Date.now();
    const timeSinceLastCheck = now - lastFavoriteCheckTime;
    
    // 如果距离上次检查不到防抖时间，延迟执行
    if (timeSinceLastCheck < FAVORITE_CHECK_DEBOUNCE_MS) {
      const remainingTime = FAVORITE_CHECK_DEBOUNCE_MS - timeSinceLastCheck;
      if (favoriteCheckDebounceTimer) {
        clearTimeout(favoriteCheckDebounceTimer);
      }
      favoriteCheckDebounceTimer = setTimeout(() => {
        lastFavoriteCheckTime = Date.now();
        batchCheckFavoritesForCards();
      }, remainingTime);
      return;
    }
    
    // 立即执行
    lastFavoriteCheckTime = now;
    batchCheckFavoritesForCards();
  }
  
  // 添加防抖标记，避免重复检查
  let isCheckingFavorites = false;

  // 如果页面有动态加载内容，使用MutationObserver监听DOM变化（只监听新增元素）
  // 使用节流机制，避免过于频繁触发
  let mutationObserverThrottle = null;
  const observer = new MutationObserver((mutations) => {
    // 检查是否有新增的收藏按钮
    const hasNewFavoriteButtons = mutations.some(mutation =>
      mutation.type === 'childList' &&
      Array.from(mutation.addedNodes).some(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          return node.querySelector('.card-favorite-btn, .favorite-btn') ||
                 node.classList?.contains('.card-favorite-btn') ||
                 node.classList?.contains('.favorite-btn');
        }
        return false;
      })
    );

    if (hasNewFavoriteButtons && !isCheckingFavorites) {
      // 节流：500ms 内最多触发一次
      if (mutationObserverThrottle) {
        clearTimeout(mutationObserverThrottle);
      }
      mutationObserverThrottle = setTimeout(() => {
        if (!isCheckingFavorites) {
          debouncedBatchCheckFavorites();
        }
      }, 500);
    }
  });

  // 监听整个文档的变化（优化配置）
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: false // 不监听属性变化以减少触发
  });
  
  // 监听用户登录状态变化（只注册一次，避免重复注册）
  if (!authChangeListenerRegistered && window.SimpleAuth && typeof window.SimpleAuth.onAuthChange === 'function') {
    authChangeListenerRegistered = true;
    window.SimpleAuth.onAuthChange(() => {
      console.log('用户登录状态变化，重新检查收藏状态');
      debouncedBatchCheckFavorites();
    });
  }
  
  // 初始检查（延迟执行，确保DOM已渲染）
  setTimeout(() => {
    debouncedBatchCheckFavorites();
  }, 500);

  // 简易图片灯箱（点击缩略图放大预览）
  setupLightbox();
  
  // 批量检查收藏状态函数（公开以便外部调用）
  async function batchCheckFavoritesForCards() {
    // 防止重复检查
    if (isCheckingFavorites) {
      console.log('📄 正在检查收藏状态，跳过重复调用');
      return;
    }

    isCheckingFavorites = true;

    try {
      // 首先检查是否是演示文稿页面（不需要收藏按钮）
      // 在函数开始时就检查，避免不必要的重试
      const isSlidesPage = document.body.hasAttribute('data-slides-page') || 
                          window.location.pathname.includes('/slides') ||
                          (document.querySelector('.collection-page') && window.location.pathname.includes('/slides'));
      
      if (isSlidesPage) {
        // 演示文稿页面不需要收藏按钮，直接返回
        isCheckingFavorites = false;
        favoriteButtonRetryCount = 0; // 重置计数器
        return;
      }
      
      // 如果收藏服务还未就绪，先只显示收藏数（如果可能）
      const favoriteButtons = document.querySelectorAll('.card-favorite-btn, .favorite-btn');
      if (favoriteButtons.length === 0) {
        // 如果重试次数超过限制，停止重试
        if (favoriteButtonRetryCount >= MAX_FAVORITE_BUTTON_RETRIES) {
          console.log('📄 未找到收藏按钮，已达到最大重试次数，停止重试');
          isCheckingFavorites = false;
          favoriteButtonRetryCount = 0; // 重置计数器
          return;
        }
        
        // 如果没有按钮，可能卡片还未渲染，快速重试一次
        favoriteButtonRetryCount++;
        console.log(`📄 未找到收藏按钮，200ms后重试 (${favoriteButtonRetryCount}/${MAX_FAVORITE_BUTTON_RETRIES})`);
        setTimeout(() => {
          isCheckingFavorites = false; // 重置标记，允许重试
          batchCheckFavoritesForCards();
        }, 200);
        return;
      }
      
      // 找到按钮，重置重试计数器
      if (favoriteButtonRetryCount > 0) {
        favoriteButtonRetryCount = 0;
      }

      // 如果收藏服务未就绪，等待服务就绪但不显示任何状态
      if (!window.favoritesService) {
        console.log('📄 收藏服务未就绪，等待服务加载...');

        // 隐藏收藏按钮直到状态确定，避免闪烁
        favoriteButtons.forEach(btn => {
          btn.style.visibility = 'hidden';
        });

        // 设置服务就绪后立即更新
        const checkServiceReady = setInterval(() => {
          if (window.favoritesService) {
            clearInterval(checkServiceReady);
            console.log('📄 收藏服务已就绪，立即更新收藏状态');

            // 恢复按钮可见性并执行检查
            favoriteButtons.forEach(btn => {
              btn.style.visibility = 'visible';
            });

            // 立即执行，无需延迟
            if (!isCheckingFavorites) {
              batchCheckFavoritesForCards();
            }
          }
        }, 100);

        // 3秒后停止检查并显示按钮
        setTimeout(() => {
          clearInterval(checkServiceReady);
          favoriteButtons.forEach(btn => {
            btn.style.visibility = 'visible';
          });
        }, 3000);

        return;
      }
    
    // SimpleAuth 可能不存在，但不需要等待（未登录用户也可以显示收藏数）
    const isLoggedIn = window.SimpleAuth && window.SimpleAuth.isLoggedIn();
    
    // 收集所有URL
    const postUrls = Array.from(favoriteButtons)
      .map(btn => {
        const url = btn.getAttribute('data-post-url') || btn.closest('[data-post-url]')?.getAttribute('data-post-url');
        return url;
      })
      .filter(url => url && url !== '#');
    
    if (postUrls.length === 0) return;

    // 使用组合查询函数（一次查询获取收藏数和用户收藏状态，最高效）
    let favoritesMap = {};
    let countsMap = {};
    
    if (window.favoritesService.batchGetFavoritesWithStatus) {
      // 使用新的组合查询函数（数据库端统计，一次查询获取所有数据）
      const result = await window.favoritesService.batchGetFavoritesWithStatus(postUrls);
      countsMap = result.counts || {};
      favoritesMap = isLoggedIn ? (result.userFavorited || {}) : {};
    } else {
      // 降级方案：分别查询（向后兼容）
      const [favoritesResult, countsResult] = await Promise.all([
        isLoggedIn
          ? window.favoritesService.batchCheckFavorites(postUrls)
          : Promise.resolve({}),
        window.favoritesService.batchGetFavoriteCounts(postUrls)
      ]);
      favoritesMap = favoritesResult;
      countsMap = countsResult;
    }

    console.log('📄 批量检查收藏状态，共', postUrls.length, '篇文章，已登录:', isLoggedIn);

    // 更新所有按钮状态
    favoriteButtons.forEach(btn => {
      const postUrl = btn.getAttribute('data-post-url') || btn.closest('[data-post-url]')?.getAttribute('data-post-url');
      if (!postUrl || postUrl === '#') return;

      const icon = btn.querySelector('.favorite-icon');
      const countEl = btn.querySelector('.favorite-count');

      // 更新收藏状态（仅已登录用户）
      if (isLoggedIn && icon) {
        const isFavorited = favoritesMap[postUrl] || false;

        if (isFavorited) {
          btn.classList.add('favorited');
          icon.textContent = '★';
          icon.style.color = '#fbbf24';
        } else {
          btn.classList.remove('favorited');
          icon.textContent = '☆';
          icon.style.color = '#9ca3af';
        }
      }

      // 更新收藏数（所有用户都能看到）
      if (countEl) {
        const count = countsMap[postUrl] || 0;
        countEl.textContent = count > 0 ? count : '0';
      }
    });

    console.log(`✅ 批量更新了 ${favoriteButtons.length} 个收藏按钮的状态（已登录: ${isLoggedIn}）`);
    } catch (error) {
      console.warn('批量检查收藏状态失败:', error);
      // 快速重试一次，如果还失败就放弃
      setTimeout(() => {
        if (!isCheckingFavorites) {
          batchCheckFavoritesForCards();
        }
      }, 1000);
    } finally {
      // 确保重置检查标记
      isCheckingFavorites = false;
    }
  }
  
  // 导出函数供外部调用
  window.batchCheckFavoritesForCards = batchCheckFavoritesForCards;

  // 批量检查点赞状态函数（类似于收藏）
  let isCheckingLikes = false;
  
  async function batchCheckLikesForCards() {
    if (isCheckingLikes) {
      console.log('📄 正在检查点赞状态，跳过重复调用');
      return;
    }

    isCheckingLikes = true;

    try {
      const likeButtons = document.querySelectorAll('.card-like-btn, .like-btn');
      if (likeButtons.length === 0) {
        setTimeout(() => {
          if (!isCheckingLikes) {
            batchCheckLikesForCards();
          }
        }, 200);
        return;
      }

      if (!window.likesService) {
        console.log('📄 点赞服务未就绪，等待服务加载...');
        likeButtons.forEach(btn => {
          btn.style.visibility = 'hidden';
        });

        const checkServiceReady = setInterval(() => {
          if (window.likesService) {
            clearInterval(checkServiceReady);
            likeButtons.forEach(btn => {
              btn.style.visibility = 'visible';
            });
            if (!isCheckingLikes) {
              batchCheckLikesForCards();
            }
          }
        }, 100);

        setTimeout(() => {
          clearInterval(checkServiceReady);
          likeButtons.forEach(btn => {
            btn.style.visibility = 'visible';
          });
        }, 3000);
        return;
      }
    
      const isLoggedIn = window.SimpleAuth && window.SimpleAuth.isLoggedIn();

      const postUrls = Array.from(likeButtons)
        .map(btn => {
          const url = btn.getAttribute('data-post-url') || btn.closest('[data-post-url]')?.getAttribute('data-post-url');
          return url;
        })
        .filter(url => url && url !== '#');
      
      if (postUrls.length === 0) return;

      let likesMap = {};
      let countsMap = {};
      
      if (isLoggedIn) {
        likesMap = await window.likesService.batchCheckLikes(postUrls) || {};
      }
      countsMap = await window.likesService.batchGetLikeCounts(postUrls) || {};

      console.log('📄 批量检查点赞状态，共', postUrls.length, '篇文章，已登录:', isLoggedIn);

      // 更新所有按钮状态
      likeButtons.forEach(btn => {
        const postUrl = btn.getAttribute('data-post-url') || btn.closest('[data-post-url]')?.getAttribute('data-post-url');
        if (!postUrl || postUrl === '#') return;

        const icon = btn.querySelector('.like-icon');
        const countEl = btn.querySelector('.like-count');

        // 更新点赞状态（仅已登录用户）
        if (isLoggedIn && icon) {
          const isLiked = likesMap[postUrl] || false;

          if (isLiked) {
            btn.classList.add('liked');
            icon.textContent = '❤️';
          } else {
            btn.classList.remove('liked');
            icon.textContent = '🤍';
          }
        }

        // 更新点赞数（所有用户都能看到）
        if (countEl) {
          const count = countsMap[postUrl] || 0;
          countEl.textContent = count > 0 ? count : '0';
        }
      });

      console.log(`✅ 批量更新了 ${likeButtons.length} 个点赞按钮的状态（已登录: ${isLoggedIn}）`);
    } catch (error) {
      console.warn('批量检查点赞状态失败:', error);
      setTimeout(() => {
        if (!isCheckingLikes) {
          batchCheckLikesForCards();
        }
      }, 1000);
    } finally {
      isCheckingLikes = false;
    }
  }
  
  // 导出函数供外部调用
  window.batchCheckLikesForCards = batchCheckLikesForCards;

  // 简单的字符串相似度计算（用于验证标题匹配）
  function calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    if (longer.length === 0) return 1.0;
    
    // 简单的匹配：检查较短字符串有多少字符在较长字符串中出现
    let matches = 0;
    const longerLower = longer.toLowerCase();
    const shorterLower = shorter.toLowerCase();
    
    for (let i = 0; i < shorterLower.length; i++) {
      if (longerLower.includes(shorterLower[i])) {
        matches++;
      }
    }
    
    return matches / longer.length;
  }
  
  async function enhanceCard(card) {
    if (card.dataset.enhanced === '1') return;
    
    // 立即标记为正在处理，避免重复处理
    card.dataset.enhanced = '1';
    
    const linkEl = card.querySelector('.post-card-link, .post-card-link-modern');
    if (!linkEl) return;

    const postUrl = linkEl.getAttribute('href');
    
    // 验证URL是否有效
    if (!postUrl || postUrl === '#' || postUrl.startsWith('javascript:')) {
      console.warn('[card-enhancements] 无效的URL，跳过增强:', postUrl);
      return;
    }
    
    // 验证卡片标题是否与URL匹配（防止错误的卡片被处理）
    const titleEl = card.querySelector('.post-card-title, .post-card-title-modern');
    const expectedTitle = titleEl ? titleEl.textContent.trim() : '';
    
    // 记录处理的卡片信息用于调试
    console.log('[card-enhancements] 开始增强卡片:', {
      url: postUrl,
      title: expectedTitle.substring(0, 50),
      cardIndex: Array.from(card.parentElement?.children || []).indexOf(card)
    });
    
    // 检查是否可以使用预生成的缩略图和摘要
    // 规范化 URL：去掉 baseurl 前缀（如果存在）
    let lookupUrl = postUrl;
    const baseurl = window.PC_BASEURL || '';
    if (baseurl && baseurl !== '/' && postUrl.startsWith(baseurl)) {
      lookupUrl = postUrl.substring(baseurl.length);
    } else if (postUrl.startsWith('/papercache/')) {
      lookupUrl = postUrl.replace('/papercache', '');
    }
    // 确保 lookupUrl 以 / 开头
    if (!lookupUrl.startsWith('/')) {
      lookupUrl = '/' + lookupUrl;
    }
    
    const hasPregenThumb = thumbnailsMapping && thumbnailsMapping[lookupUrl];
    const hasPregenExcerpt = excerptsMapping && excerptsMapping[lookupUrl];
    
    // 调试缩略图匹配
    if (hasPregenThumb) {
      console.log('🖼️ 找到预生成缩略图:', lookupUrl, '->', thumbnailsMapping[lookupUrl]);
    } else {
      console.log('❌ 未找到预生成缩略图:', lookupUrl);
      // 调试：显示所有可用的键，帮助诊断匹配问题
      const availableKeys = Object.keys(thumbnailsMapping || {});
      console.log('🔍 可用的缩略图键数量:', availableKeys.length);
      if (availableKeys.length > 0) {
        console.log('🔍 前3个可用键:', availableKeys.slice(0, 3));
        // 检查是否有相似的键
        const similarKeys = availableKeys.filter(key => key.includes(lookupUrl.split('/').pop()));
        if (similarKeys.length > 0) {
          console.log('🔍 找到相似键:', similarKeys.slice(0, 3));
        }
      }
    }
    
    // 检查是否可以使用预生成内容
    let usedPregenThumb = false;
    let usedPregenExcerpt = false;
    
    // 1) 检查缩略图状态
    const hasExistingThumb = !!card.querySelector('.post-card-thumb, .post-card-thumb-modern');
    const hasServerRenderedThumb = hasExistingThumb && card.querySelector('.post-card-thumb img, .post-card-thumb-modern img');
    
    console.log('🔍 缩略图检查:', { 
      hasPregenThumb, 
      hasExistingThumb, 
      hasServerRenderedThumb,
      skipThumb: hasServerRenderedThumb 
    });
    
    // 如果服务器端已经渲染了缩略图，跳过客户端处理
    if (hasServerRenderedThumb) {
      console.log('✅ 服务器端已渲染缩略图，跳过客户端处理');
      usedPregenThumb = true; // 标记为已使用预生成缩略图
      pregenThumbCount++;
    } else if (hasPregenThumb) {
      // 只有在没有服务器端缩略图时才客户端处理
      // 再次验证URL（防止在检查过程中URL被修改）
      const currentPostUrl = linkEl.getAttribute('href');
      if (currentPostUrl !== postUrl) {
        console.warn('[card-enhancements] URL在添加预生成缩略图时被修改，停止处理');
        return;
      }
      
      const body = ensureBody(card);
      
      // 验证body是否还在当前卡片中
      if (!card.contains(body)) {
        console.warn('[card-enhancements] 卡片结构在添加预生成缩略图时改变，停止处理');
        return;
      }
      
      const thumb = document.createElement('div');
      const isModern = card.classList.contains('post-card-modern');
      thumb.className = (isModern ? 'post-card-thumb-modern' : 'post-card-thumb');
      thumb.innerHTML = `<img loading="lazy" src="${thumbnailsMapping[lookupUrl]}" alt="thumbnail" style="width: 100%; height: 160px; object-fit: cover;">`;
      body.parentNode.insertBefore(thumb, body);
      usedPregenThumb = true;
      pregenThumbCount++;
      console.log('🖼️ 客户端添加预生成缩略图，URL:', postUrl);
    }
    
    // 2) 使用预生成摘要
    if (hasPregenExcerpt && !card.querySelector('.post-card-excerpt, .post-card-excerpt-modern')) {
      // 再次验证URL（防止在检查过程中URL被修改）
      const currentPostUrl = linkEl.getAttribute('href');
      if (currentPostUrl !== postUrl) {
        console.warn('[card-enhancements] URL在添加预生成摘要时被修改，停止处理');
        return;
      }
      
      const body = ensureBody(card);
      
      // 验证body是否还在当前卡片中
      if (!card.contains(body)) {
        console.warn('[card-enhancements] 卡片结构在添加预生成摘要时改变，停止处理');
        return;
      }
      
      const excerpt = document.createElement('p');
      excerpt.className = (card.classList.contains('post-card-modern') ? 'post-card-excerpt-modern' : 'post-card-excerpt');
      excerpt.textContent = truncate(excerptsMapping[lookupUrl], 100);
      body.appendChild(excerpt);
      usedPregenExcerpt = true;
      pregenExcerptCount++;
      console.log('✅ 使用预生成摘要，URL:', postUrl, '摘要:', truncate(excerptsMapping[lookupUrl], 50) + '...');
    }
    
    // 如果缩略图和摘要都有预生成版本，完全跳过fetch
    if (usedPregenThumb && usedPregenExcerpt) {
      console.log('🚀 使用预生成缩略图和摘要，跳过fetch');
      return;
    }
    
    // 如果只有部分预生成内容，仍然需要fetch来补充缺失的内容
    if (usedPregenThumb || usedPregenExcerpt) {
      console.log('🚀 部分使用预生成内容，仍需fetch补充');
    }
    
    // 否则，回退到原来的fetch方式
    try {
      // 在fetch前再次验证URL（防止URL被修改）
      const currentPostUrl = linkEl.getAttribute('href');
      if (!currentPostUrl || currentPostUrl !== postUrl) {
        console.warn('[card-enhancements] URL在增强过程中被修改，停止处理:', {
          original: postUrl,
          current: currentPostUrl
        });
        return;
      }
      
      const html = await fetch(postUrl, { credentials: 'same-origin' }).then(r => r.text());
      const doc = new DOMParser().parseFromString(html, 'text/html');
      
      // 验证获取的HTML是否是正确的文章页面
      const fetchedTitle = doc.querySelector('h1, .post-title, .page-title, title');
      const fetchedTitleText = fetchedTitle ? fetchedTitle.textContent.trim() : '';
      
      // 如果标题完全不匹配（差异超过50%），可能是错误的页面
      if (expectedTitle && fetchedTitleText) {
        const similarity = calculateSimilarity(expectedTitle.toLowerCase(), fetchedTitleText.toLowerCase());
        if (similarity < 0.3) {
          console.warn('[card-enhancements] 获取的页面标题与卡片标题不匹配:', {
            cardTitle: expectedTitle.substring(0, 50),
            fetchedTitle: fetchedTitleText.substring(0, 50),
            url: postUrl,
            similarity
          });
          // 不返回，继续处理，但记录警告
        }
      }

      // 1) 缩略图：顺序选择第一个"图/figure/fig"相关的非公式图片；否则占位
      if (!card.querySelector('.post-card-thumb, .post-card-thumb-modern')) {
        const imgSrc = findFirstFigureImage(doc);
        const body = ensureBody(card);
        
        // 再次验证body是否还在当前卡片中（防止DOM结构改变）
        if (!card.contains(body)) {
          console.warn('[card-enhancements] 卡片结构在增强过程中改变，停止添加缩略图');
          return;
        }
        
        const thumb = document.createElement('div');
        // 根据卡片类型使用不同的CSS类
        const isModern = card.classList.contains('post-card-modern');
        thumb.className = (isModern ? 'post-card-thumb-modern' : 'post-card-thumb') + (imgSrc ? '' : ' placeholder');
        if (imgSrc) {
          // 检查是否是兜底图片（data URL）
          if (imgSrc.startsWith('data:')) {
            console.log('🖼️ 使用ASCII艺术字兜底图片');
            // 直接使用兜底图片
            thumb.innerHTML = `<img loading="lazy" src="${imgSrc}" alt="PaperCache ASCII Art" style="width: 100%; height: 160px; object-fit: contain;">`;
          } else {
            console.log('🖼️ 使用真实图片:', imgSrc.substring(0, 50) + '...');
            // 使用真实图片
            const resolvedImg = new URL(imgSrc, new URL(postUrl, location.origin)).href;
            thumb.innerHTML = `<img loading="lazy" src="${resolvedImg}" alt="thumbnail" style="width: 100%; height: 160px; object-fit: cover;">`;
          }
        } else {
          console.log('❌ 没有找到任何图片');
        }
        body.parentNode.insertBefore(thumb, body);
      }

      // 2) 摘要：优先使用预生成的摘要，否则动态提取
      if (!card.querySelector('.post-card-excerpt, .post-card-excerpt-modern')) {
        let excerptText = '';
        
        // 首先尝试从预生成的摘要映射中获取
        // 处理URL格式差异：前端可能是完整路径，摘要映射是相对路径
        let lookupUrl = postUrl;
        if (postUrl.startsWith('/papercache/papers/')) {
          lookupUrl = postUrl.replace('/papercache', '');
        }

        // 静默处理URL匹配
        
        if (!excerptsMapping || !excerptsMapping[lookupUrl]) {
          console.log('🔍 预生成摘要不存在，开始动态提取，文章URL:', postUrl);
        }

        if (excerptsMapping && excerptsMapping[lookupUrl]) {
          excerptText = excerptsMapping[lookupUrl];
          pregenCount++;
          console.log('✅ 使用预生成摘要:', excerptText.substring(0, 50) + '...');
        } else {
          // 如果没有预生成摘要，则动态提取
          console.log('🔍 预生成摘要不存在，开始动态提取，文章URL:', postUrl);
          
          // 再次验证URL和卡片结构（在提取摘要前）
          const currentPostUrl = linkEl.getAttribute('href');
          if (currentPostUrl !== postUrl) {
            console.warn('[card-enhancements] URL在提取摘要时被修改，停止处理');
            return;
          }
          
          const body = ensureBody(card);
          if (!card.contains(body)) {
            console.warn('[card-enhancements] 卡片结构在提取摘要时改变，停止处理');
            return;
          }
          
          const postContent = doc.querySelector('.post-content');

          if (postContent) {
            const headingNodes = Array.from(postContent.querySelectorAll('h1,h2,h3,h4,h5,h6'));
            console.log('🔍 找到', headingNodes.length, '个标题元素');
            
            const a1 = headingNodes.find(h => /(A1\s*)?主要贡献/.test(h.textContent.trim()));
            if (a1) {
              console.log('✅ 找到A1主要贡献段落');
              // 找到 A1 后的首个段落或列表
              let cur = a1.nextElementSibling;
              while (cur) {
                if (cur.tagName === 'P') {
                  excerptText = cur.textContent.trim();
                  dynamicCount++;
                  console.log('✅ 从A1段落提取到摘要:', excerptText.substring(0, 50) + '...');
                  break;
                }
                if (cur.tagName === 'UL' || cur.tagName === 'OL') {
                  const li = cur.querySelector('li');
                  if (li) {
                    excerptText = li.textContent.trim();
                    dynamicCount++;
                    console.log('✅ 从A1列表提取到摘要:', excerptText.substring(0, 50) + '...');
                    break;
                  }
                }
                // 跳过空元素
                cur = cur.nextElementSibling;
              }
            } else {
              console.log('❌ 没有找到A1主要贡献段落');
            }
          } else {
            console.log('❌ 没有找到.post-content元素');
          }

          if (!excerptText) {
            const p = Array.from(doc.querySelectorAll('.post-content p'))
              .map(x => x.textContent.trim())
              .find(t => t && t.length >= 60);
            if (p) excerptText = p.replace(/\s+/g, ' ');
          }
        }

        if (excerptText) {
          const body = ensureBody(card);
          const para = document.createElement('p');
          // 根据卡片类型使用不同的CSS类
          const isModern = card.classList.contains('post-card-modern');
          para.className = isModern ? 'post-card-excerpt-modern' : 'post-card-excerpt';
          para.textContent = truncate(excerptText, 100);
          body.appendChild(para);
          console.log(`✅ 为卡片添加了摘要: ${truncate(excerptText, 50)}...`);
        } else {
          console.log('❌ 无法提取摘要文本');
        }
      }

      card.dataset.enhanced = '1';
    } catch (e) {
      console.error('Failed to enhance card:', e);
      // 清理DOM解析器，释放内存
      if (doc) {
        doc = null;
      }
    } finally {
      // 确保标记为已处理
      card.dataset.enhanced = '1';
    }
  }

  function ensureBody(card) {
    let body = card.querySelector('.post-card-body, .post-card-body-modern');
    if (!body) {
      body = document.createElement('div');
      // 根据卡片类型使用不同的CSS类
      const isModern = card.classList.contains('post-card-modern');
      body.className = isModern ? 'post-card-body-modern' : 'post-card-body';
      const link = card.querySelector('.post-card-link, .post-card-link-modern');
      if (link) {
        link.appendChild(body);
      }
    }
    return body;
  }

  function truncate(s, n) {
    return s.length <= n ? s : s.slice(0, n - 1) + '…';
  }
  function findFirstFigureImage(doc) {
    const patternFigureStart = /^(图\s*\d+|figure\s*\d+|fig\.?\s*\d+)/i; // 匹配以"图1"、"Figure 1"等开头的文本
    const patternFigureContain = /(图\s*\d+|figure\s*\d+|fig\.?\s*\d+)/i; // 匹配包含"图1"等的文本
    const patternTable = /(\btable\b|\btab\.?\b|表\d+|表\s|^表|表$)/i; // 匹配表相关字段
    const patternFormula = /(\bformula\b|\beq\.?\b|\bequation\b|公式\d+|公式\s|^公式|公式$)/i; // 匹配公式相关字段
    const patternAlgorithm = /(\b算法\b|\balgorithm\b)/i; // 匹配算法字段
    const content = doc.querySelector('.post-content') || doc;

    // 辅助函数：检查文本是否包含表/公式/算法字段
    const containsTableOrFormula = (text) => {
      return text && (patternTable.test(text) || patternFormula.test(text) || patternAlgorithm.test(text));
    };
    
    // 辅助函数：检查src是否可用（不支持相对路径）
    const isUsableSrc = (src) => {
      if (!src) return false;
      // 支持 data URI, http/https, file 协议
      if (src.startsWith('data:')) return true;
      if (src.startsWith('http://') || src.startsWith('https://')) return true;
      if (src.startsWith('file://')) return true;
      // 不支持相对路径
      return false;
    };

    // 辅助函数：获取figure的annotation文本（包括figcaption、alt、title）
    const getFigureAnnotation = (fig) => {
      const cap = fig.querySelector('figcaption');
      const img = fig.querySelector('img[src]');
      if (!img) return '';
      
      const capText = (cap ? cap.textContent : '').trim();
      const alt = (img.getAttribute('alt') || '').trim();
      const title = (img.getAttribute('title') || '').trim();
      
      return (capText + ' ' + alt + ' ' + title).trim();
    };

    // 辅助函数：获取figure最近的邻居节点文本（仅在annotation为空时使用）
    // 完整实现 gen_thumbs.py 的逻辑
    const getNearestNeighborText = (fig) => {
      // 向后搜索（跳过<br>，遇到下一个<figure>或有内容的元素则停止）
      let next = fig.nextSibling;
      while (next) {
        if (next.nodeType === Node.ELEMENT_NODE) {
          // 遇到下一个figure就停止
          if (next.tagName === 'FIGURE') break;
          
          // 跳过<br>标签
          if (next.tagName === 'BR') {
            next = next.nextSibling;
            continue;
          }
          
          // 遇到有内容的元素，检查是否以"图"开头
          const text = next.textContent.trim();
          if (text) {
            if (patternFigureStart.test(text)) return text;
            // 遇到有内容但不匹配的元素，停止搜索
            break;
          }
        } else if (next.nodeType === Node.TEXT_NODE) {
          const text = next.textContent.trim();
          if (text) {
            if (patternFigureStart.test(text)) return text;
            // 遇到有内容但不匹配的文本，停止搜索
            break;
          }
        }
        next = next.nextSibling;
      }
      
      // 向前搜索（跳过<br>，遇到<figure>或<p>标签则停止）
      let prev = fig.previousSibling;
      while (prev) {
        if (prev.nodeType === Node.ELEMENT_NODE) {
          // 遇到<figure>或<p>标签就停止
          if (prev.tagName === 'FIGURE' || prev.tagName === 'P') break;
          
          // 跳过<br>标签
          if (prev.tagName === 'BR') {
            prev = prev.previousSibling;
            continue;
          }
          
          // 遇到有内容的元素，检查是否以"图"开头
          const text = prev.textContent.trim();
          if (text) {
            if (patternFigureStart.test(text)) return text;
            // 遇到有内容但不匹配的元素，停止搜索
            break;
          }
        } else if (prev.nodeType === Node.TEXT_NODE) {
          // 检查文本节点的父元素是否是<p>
          if (prev.parentElement && prev.parentElement.tagName === 'P') break;
          
          const text = prev.textContent.trim();
          if (text) {
            if (patternFigureStart.test(text)) return text;
            // 遇到有内容但不匹配的文本，停止搜索
            break;
          }
        }
        prev = prev.previousSibling;
      }
      
      return '';
    };

    // 1. 从前到后遍历所有可行图，找到第一个满足条件的图返回
    const figures = Array.from(content.querySelectorAll('figure'));

    for (let i = 0; i < figures.length; i++) {
      const fig = figures[i];
      const img = fig.querySelector('img[src]');
      if (!img) continue;

      const annotation = getFigureAnnotation(fig);
      
      // 2. 首先必须是个html Figure
      if (fig.tagName !== 'FIGURE') continue;
      
      const src = img.getAttribute('src');
      
      // 检查src是否可用（不支持相对路径）
      if (!isUsableSrc(src)) {
        console.log(`跳过第${i+1}个figure: src不可用（相对路径）`);
        continue;
      }
      
      console.log(`检查第${i+1}个figure:`, {
        imgSrc: src.substring(0, 50) + '...',
        annotation: annotation
      });
      
      // 如果figure包含alt/annotation：annotation如果以"图/figure/fig"开头，可行，选中返回
      if (annotation && patternFigureStart.test(annotation)) {
        // 3. 排除一些非法图片：如果figure annotation包含表/公式字段的图片不选择
        if (!containsTableOrFormula(annotation)) {
          console.log('✓ 匹配成功！通过annotation');
          return src;
        }
      }
      
      // 如果figure的annotation为空，则检查最近的邻居节点
      if (!annotation || annotation.trim() === '') {
        const neighborText = getNearestNeighborText(fig);
        if (neighborText) {
          console.log(`第${i+1}个figure的最近邻居文本:`, neighborText.substring(0, 50));
        }
        if (neighborText && patternFigureStart.test(neighborText)) {
          // 3. 排除一些非法图片：如果邻居文本包含表/公式字段的图片不选择
          if (!containsTableOrFormula(neighborText)) {
            console.log('✓ 匹配成功！通过最近邻居文本');
            return src;
          } else {
            console.log('✗ 被表/公式/算法字段过滤掉');
          }
        }
      }
    }

    // 4. 段首"图1/Figure 1/Fig. 1" → 回溯至上一个 <img> 或 <figure>
    // 或者段落本身包含图片且文本中包含"图X/Figure X"
    const paras = Array.from(content.querySelectorAll('p'));
    
    for (const p of paras) {
      const text = (p.textContent || '').trim();
      
      // 首先检查段落本身是否包含图片
      const pImg = p.querySelector('img[src]');
      if (pImg && patternFigureContain.test(text) && !containsTableOrFormula(text)) {
        // 段落包含图片且文本中有"图X/Figure X"
        const src = pImg.getAttribute('src');
        const alt = pImg.getAttribute('alt') || '';
        const title = pImg.getAttribute('title') || '';
        const hint = (alt + ' ' + title).trim();
        if (!containsTableOrFormula(hint) && isUsableSrc(src)) {
          console.log('✓ 通过段落本身找到图片:', src.substring(0, 50) + '...');
          return src;
        }
      }
      
      // 如果段落以"图X/Figure X"开头，但不包含图片，则向前回溯
      if (patternFigureStart.test(text) && !containsTableOrFormula(text) && !pImg) {
        // 向上找最近的图片（优先找figure中的img，然后找单独的img）
        let prev = p.previousElementSibling;
        while (prev) {
          // 首先检查是否是figure标签
          if (prev.tagName === 'FIGURE') {
            const figImg = prev.querySelector('img[src]');
            if (figImg) {
              const src = figImg.getAttribute('src') || '';
              const alt = figImg.getAttribute('alt') || '';
              const title = figImg.getAttribute('title') || '';
              const hint = (alt + ' ' + title);
              if (!containsTableOrFormula(hint) && isUsableSrc(src)) {
                console.log('✓ 通过段落回溯找到figure中的图片:', src.substring(0, 50) + '...');
                return src;
              }
            }
          }
          // 然后检查其他元素中的img
          const cand = prev.querySelector && prev.querySelector('img[src]');
          if (cand) {
            const src = cand.getAttribute('src') || '';
            const alt = cand.getAttribute('alt') || '';
            const title = cand.getAttribute('title') || '';
            const hint = (alt + ' ' + title);
            if (!containsTableOrFormula(hint) && isUsableSrc(src)) {
              console.log('✓ 通过段落回溯找到图片:', src.substring(0, 50) + '...');
              return src;
            }
          }
          prev = prev.previousElementSibling;
        }
      }
    }
    
    // 5. 如果最终没找到合适的图，重新过滤一遍全部图，返回不包含表/公式字段的第一张图
    for (const fig of figures) {
      const img = fig.querySelector('img[src]');
      if (!img) continue;
      
      const src = img.getAttribute('src');
      if (!isUsableSrc(src)) continue;
      
      const annotation = getFigureAnnotation(fig);
      const neighborText = getNearestNeighborText(fig);
      const allText = (annotation + ' ' + neighborText).trim();
      
      // 排除包含表/公式字段的图片
      if (!containsTableOrFormula(allText)) {
        console.log('✓ 兜底：返回第一个不含表/公式的图片');
        return src;
      }
    }
    
    // 6. 如果还是不能，返回一个打印ASCII PaperCache的图片
    console.log('⚠️ 所有规则都未匹配，使用ASCII兜底图片');
    return createASCIIPaperCacheImage();
  }

  // 创建ASCII PaperCache图片的函数
  function createASCIIPaperCacheImage() {
    console.log('🎨 生成PaperCache ASCII艺术字兜底图片');
    
    // 纯ASCII风格，包含完整的PaperCache ASCII艺术字
    const svg = `
    <svg width="400" height="200" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f8fafc"/>
      <rect x="10" y="10" width="380" height="180" fill="none" stroke="#3b82f6" stroke-width="1"/>

      <!-- 简单的ASCII艺术字 -->
      <text x="200" y="40" font-family="monospace" font-size="12" text-anchor="middle" fill="#3b82f6">+--------------------------------------+</text>
      <text x="200" y="60" font-family="monospace" font-size="16" font-weight="bold" text-anchor="middle" fill="#3b82f6">PaperCache</text>
      <text x="200" y="80" font-family="monospace" font-size="10" text-anchor="middle" fill="#3b82f6">AI Research Papers</text>
      <text x="200" y="100" font-family="monospace" font-size="12" text-anchor="middle" fill="#3b82f6">+--------------------------------------+</text>
      
      <!-- 分隔线 -->
      <text x="200" y="120" font-family="monospace" font-size="8" text-anchor="middle" fill="#4a5568">────────────────────────────────────────────────────────────────────────────</text>
      
      <!-- 副标题 -->
      <text x="200" y="140" font-family="monospace" font-size="10" text-anchor="middle" fill="#4a5568">AI Research Papers Collection</text>
      <text x="200" y="155" font-family="monospace" font-size="8" text-anchor="middle" fill="#718096">No Image Available</text>
      
      <!-- 底部装饰 -->
      <text x="200" y="175" font-family="monospace" font-size="8" text-anchor="middle" fill="#4a5568">AI-Powered Paper Analysis & Caching System</text>
    </svg>
    `;
    
    // 将SVG转换为base64 data URL
    const base64 = btoa(unescape(encodeURIComponent(svg.trim())));
    const dataUrl = `data:image/svg+xml;charset=utf-8;base64,${base64}`;
    
    console.log('✅ ASCII艺术字生成完成，长度:', dataUrl.length);
    return dataUrl;
  }

  function setupLightbox() {
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(0,0,0,0.8)';
    overlay.style.display = 'none';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '9999';

    const img = document.createElement('img');
    img.style.maxWidth = '90%';
    img.style.maxHeight = '90%';
    img.style.objectFit = 'contain';
    img.alt = 'preview';

    overlay.appendChild(img);
    overlay.addEventListener('click', () => { overlay.style.display = 'none'; img.src = ''; });
    document.body.appendChild(overlay);

    document.addEventListener('click', (e) => {
      const target = e.target;
      if (target && target.closest && target.closest('.post-card-thumb')) {
        const imgEl = target.closest('.post-card-thumb').querySelector('img');
        if (imgEl && imgEl.src) {
          e.preventDefault();
          img.src = imgEl.src;
          overlay.style.display = 'flex';
        }
      }
    });
  }
}

// 尽早初始化，不等待DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCardEnhancements);
} else {
  initCardEnhancements();
}

// 同时立即执行一次收藏和点赞状态预检查（如果可能）
if (window.favoritesService && document.readyState !== 'loading') {
  Promise.resolve().then(() => {
    const favoriteButtons = document.querySelectorAll('.card-favorite-btn, .favorite-btn');
    if (favoriteButtons.length > 0) {
      window.batchCheckFavoritesForCards?.();
    }
  });
}

if (window.likesService && document.readyState !== 'loading') {
  Promise.resolve().then(() => {
    const likeButtons = document.querySelectorAll('.card-like-btn, .like-btn');
    if (likeButtons.length > 0) {
      window.batchCheckLikesForCards?.();
    }
  });
}

// Turbolinks 页面加载时也初始化
document.addEventListener('turbolinks:load', function() {
  console.log('📄 Turbolinks 页面加载，重新初始化卡片增强');
  // 重置重试计数器和防抖时间
  favoriteButtonRetryCount = 0;
  lastFavoriteCheckTime = 0;
  if (favoriteCheckDebounceTimer) {
    clearTimeout(favoriteCheckDebounceTimer);
    favoriteCheckDebounceTimer = null;
  }
  // 重置认证监听器标记，允许在新页面重新注册
  authChangeListenerRegistered = false;
  initCardEnhancements();
  // 延迟执行收藏和点赞状态检查，避免与初始化冲突
  // 但先检查是否是演示文稿页面
  const isSlidesPage = document.body.hasAttribute('data-slides-page') || 
                      window.location.pathname.includes('/slides') ||
                      (document.querySelector('.collection-page') && window.location.pathname.includes('/slides'));
  
  if (!isSlidesPage) {
    setTimeout(() => {
      if (window.batchCheckFavoritesForCards) {
        window.batchCheckFavoritesForCards();
      }
      if (window.batchCheckLikesForCards) {
        window.batchCheckLikesForCards();
      }
    }, 1000);
  }
});

