console.log('🚀 card-enhancements.js 脚本已加载');

// 全局摘要映射
let excerptsMapping = null;

document.addEventListener('DOMContentLoaded', async () => {
  console.log('📄 DOM 已加载，开始处理卡片');
  
  // 尝试加载预生成的摘要映射
  try {
    const response = await fetch('/papercache/assets/data/excerpts.json');
    if (response.ok) {
      excerptsMapping = await response.json();
      console.log('✅ 预生成摘要映射加载成功，包含', Object.keys(excerptsMapping).length, '个文章');
    } else {
      console.log('⚠️ 预生成摘要映射不存在，将使用动态生成');
      excerptsMapping = {};
    }
  } catch (error) {
    console.log('⚠️ 预生成摘要映射加载失败，将使用动态生成');
    excerptsMapping = {};
  }
  
  const cards = Array.from(document.querySelectorAll('.post-item.post-card, .post-item.post-card-modern'))
    .filter(card => card.querySelector('.post-card-link, .post-card-link-modern'));
  
  console.log(`🔍 找到 ${cards.length} 个文章卡片`);

  // 仅在需要时才抓取：无缩略图或无摘要才排队
  function needsEnhance(card) {
    const hasThumb = !!card.querySelector('.post-card-thumb img, .post-card-thumb-modern img');
    const hasExcerpt = !!card.querySelector('.post-card-excerpt, .post-card-excerpt-modern');
    // 如果没有摘要，就需要增强
    return !hasExcerpt;
  }

  // 简易并发限制队列，避免一次性抓取过多页面
  const MAX_CONCURRENCY = 4; // 增加并发数
  const MAX_CARDS_TO_PROCESS = 100; // 增加处理的卡片数量
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
        if (needsEnhance(card) && processedCount < MAX_CARDS_TO_PROCESS) {
          processedCount++;
          schedule(() => enhanceCard(card));
        }
        io.unobserve(card);
      }
    });
  }, { rootMargin: '200px' });

  cards.forEach(card => io.observe(card));
  
  // 预加载前几个卡片
  setTimeout(() => {
    const firstCards = cards.slice(0, 6);
    firstCards.forEach(card => {
      if (needsEnhance(card) && processedCount < MAX_CARDS_TO_PROCESS) {
        processedCount++;
        schedule(() => enhanceCard(card));
      }
    });
  }, 500);

  // 简易图片灯箱（点击缩略图放大预览）
  setupLightbox();

  async function enhanceCard(card) {
    if (card.dataset.enhanced === '1') return;
    
    // 立即标记为正在处理，避免重复处理
    card.dataset.enhanced = '1';
    
    const linkEl = card.querySelector('.post-card-link, .post-card-link-modern');
    if (!linkEl) return;

    const postUrl = linkEl.getAttribute('href');
    try {
      const html = await fetch(postUrl, { credentials: 'same-origin' }).then(r => r.text());
      const doc = new DOMParser().parseFromString(html, 'text/html');

      // 1) 缩略图：顺序选择第一个"图/figure/fig"相关的非公式图片；否则占位
      if (!card.querySelector('.post-card-thumb, .post-card-thumb-modern')) {
        const imgSrc = findFirstFigureImage(doc);
        const body = ensureBody(card);
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

        // 静默处理URL匹配，只在需要时记录
        if (!excerptsMapping || !excerptsMapping[lookupUrl]) {
          console.log('🔍 预生成摘要不存在，开始动态提取，文章URL:', postUrl);
        }

        if (excerptsMapping && excerptsMapping[lookupUrl]) {
          excerptText = excerptsMapping[lookupUrl];
          console.log('✅ 使用预生成摘要:', excerptText.substring(0, 50) + '...');
        } else {
          // 如果没有预生成摘要，则动态提取
          console.log('🔍 预生成摘要不存在，开始动态提取，文章URL:', postUrl);
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
                  console.log('✅ 从A1段落提取到摘要:', excerptText.substring(0, 50) + '...');
                  break;
                }
                if (cur.tagName === 'UL' || cur.tagName === 'OL') {
                  const li = cur.querySelector('li');
                  if (li) {
                    excerptText = li.textContent.trim();
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
          para.textContent = truncate(excerptText, 80);
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
      <rect x="10" y="10" width="380" height="180" fill="none" stroke="#667eea" stroke-width="1"/>
      
      <!-- 简单的ASCII艺术字 -->
      <text x="200" y="40" font-family="monospace" font-size="12" text-anchor="middle" fill="#667eea">+--------------------------------------+</text>
      <text x="200" y="60" font-family="monospace" font-size="16" font-weight="bold" text-anchor="middle" fill="#667eea">PaperCache</text>
      <text x="200" y="80" font-family="monospace" font-size="10" text-anchor="middle" fill="#667eea">AI Research Papers</text>
      <text x="200" y="100" font-family="monospace" font-size="12" text-anchor="middle" fill="#667eea">+--------------------------------------+</text>
      
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
});


