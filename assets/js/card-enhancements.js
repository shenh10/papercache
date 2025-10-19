document.addEventListener('DOMContentLoaded', () => {
  const cards = Array.from(document.querySelectorAll('.post-item.post-card'))
    .filter(card => card.querySelector('.post-card-link'));

  // 仅在需要时才抓取：无缩略图或无摘要才排队
  function needsEnhance(card) {
    const hasThumb = !!card.querySelector('.post-card-thumb img');
    const hasExcerpt = !!card.querySelector('.post-card-excerpt');
    return !(hasThumb && hasExcerpt);
  }

  // 简易并发限制队列，避免一次性抓取过多页面
  const MAX_CONCURRENCY = 2; // 降低并发数
  const MAX_CARDS_TO_PROCESS = 50; // 限制处理的卡片数量
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
  }, { rootMargin: '100px' });

  cards.forEach(card => io.observe(card));

  // 简易图片灯箱（点击缩略图放大预览）
  setupLightbox();

  async function enhanceCard(card) {
    if (card.dataset.enhanced === '1') return;
    
    // 立即标记为正在处理，避免重复处理
    card.dataset.enhanced = '1';
    
    const linkEl = card.querySelector('.post-card-link');
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
        thumb.className = 'post-card-thumb' + (imgSrc ? '' : ' placeholder');
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

      // 2) 摘要：优先 "A1 主要贡献" 段落，否则正文第一段较长文本
      if (!card.querySelector('.post-card-excerpt')) {
        const postContent = doc.querySelector('.post-content');
        let excerptText = '';

        if (postContent) {
          const headingNodes = Array.from(postContent.querySelectorAll('h1,h2,h3,h4,h5,h6'));
          const a1 = headingNodes.find(h => /A1\s*主要贡献/.test(h.textContent.trim()));
          if (a1) {
            // 找到 A1 后的首个段落或列表
            let cur = a1.nextElementSibling;
            while (cur) {
              if (cur.tagName === 'P') {
                excerptText = cur.textContent.trim();
                break;
              }
              if (cur.tagName === 'UL' || cur.tagName === 'OL') {
                const li = cur.querySelector('li');
                if (li) {
                  excerptText = li.textContent.trim();
                  break;
                }
              }
              // 跳过空元素
              cur = cur.nextElementSibling;
            }
          }
        }

        if (!excerptText) {
          const p = Array.from(doc.querySelectorAll('.post-content p'))
            .map(x => x.textContent.trim())
            .find(t => t && t.length >= 60);
          if (p) excerptText = p.replace(/\s+/g, ' ');
        }

        if (excerptText) {
          const body = ensureBody(card);
          const para = document.createElement('p');
          para.className = 'post-card-excerpt';
          para.textContent = truncate(excerptText, 160);
          body.appendChild(para);
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
    let body = card.querySelector('.post-card-body');
    if (!body) {
      body = document.createElement('div');
      body.className = 'post-card-body';
      const link = card.querySelector('.post-card-link');
      link.appendChild(body);
    }
    return body;
  }

  function truncate(s, n) {
    return s.length <= n ? s : s.slice(0, n - 1) + '…';
  }
  function findFirstFigureImage(doc) {
    const patternFigure = /^(图\s*\d+|figure\s*\d+|fig\.?\s*\d+)/i; // 匹配以"图1"、"Figure 1"等开头的文本
    const patternTable = /(表|table|Table)/i; // 匹配表相关字段
    const patternFormula = /(公式|katex|latex|formula|equation|算法)/i; // 匹配公式相关字段，移除math避免误判
    const content = doc.querySelector('.post-content') || doc;

    // 辅助函数：检查是否为公式文本
    const isFormulaText = (text) => {
      return text && patternFormula.test(text);
    };

    // 辅助函数：检查是否为表格文本
    const isTableText = (text) => {
      return text && patternTable.test(text);
    };

    // 辅助函数：检查是否为图片文本
    const isFigureText = (text) => {
      return text && patternFigure.test(text);
    };

    // 辅助函数：检查图片src是否像表格
    const isTableLikeSrc = (src) => {
      return src && (src.includes('table') || src.includes('Table'));
    };

    // 辅助函数：检查文本是否包含表/公式字段
    const containsTableOrFormula = (text) => {
      return text && (patternTable.test(text) || patternFormula.test(text));
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

    // 辅助函数：获取figure紧邻的邻居节点文本
    const getNeighborText = (fig) => {
      // 检查父节点<p>
      const parent = fig.parentElement;
      if (parent && parent.tagName === 'P') {
        const pText = parent.textContent.trim();
        if (pText && patternFigure.test(pText)) return pText;
      }
      
      // 检查下一个节点（跳过<br>等无意义标签，但遇到<figure>就停止）
      let next = fig.nextSibling;
      while (next) {
        // 如果遇到空白文本节点或<br>标签，跳过
        if (next.nodeType === Node.TEXT_NODE && !next.textContent.trim()) {
          next = next.nextSibling;
          continue;
        }
        if (next.nodeType === Node.ELEMENT_NODE && next.tagName === 'BR') {
          next = next.nextSibling;
          continue;
        }
        // 遇到其他节点，停止循环
        break;
      }
      
      console.log('检查下一个节点:', next ? next.tagName || 'TEXT' : 'null');

      // 检查找到的节点（不能是<figure>）
      if (next) {
        // 如果是<figure>标签，不处理，直接返回空
        if (next.nodeType === Node.ELEMENT_NODE && next.tagName === 'FIGURE') {
          return '';
        } else if (next.nodeType === Node.TEXT_NODE) {
          const text = next.textContent.trim();
          if (text && patternFigure.test(text)) return text;
        } else if (next.nodeType === Node.ELEMENT_NODE) {
          // 检查所有元素节点，包括P、STRONG、BLOCKQUOTE等
          const text = next.textContent.trim();
          if (text && patternFigure.test(text)) return text;
        }
      }
      
      // 检查前一个节点
      let prev = fig.previousSibling;
      while (prev) {
        // 如果遇到空白文本节点或<br>标签，跳过
        if (prev.nodeType === Node.TEXT_NODE && !prev.textContent.trim()) {
          prev = prev.previousSibling;
          continue;
        }
        if (prev.nodeType === Node.ELEMENT_NODE && prev.tagName === 'BR') {
          prev = prev.previousSibling;
          continue;
        }
        // 遇到其他节点，停止循环
        break;
      }
      
      if (prev) {
        // 如果是<figure>标签，不处理，直接返回空
        if (prev.nodeType === Node.ELEMENT_NODE && prev.tagName === 'FIGURE') {
          return '';
        } else if (prev.nodeType === Node.TEXT_NODE) {
          const text = prev.textContent.trim();
          if (text && patternFigure.test(text)) return text;
        } else if (prev.nodeType === Node.ELEMENT_NODE) {
          // 检查所有元素节点，包括P、STRONG、BLOCKQUOTE等
          const text = prev.textContent.trim();
          if (text && patternFigure.test(text)) return text;
        }
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
      
      console.log(`检查第${i+1}个figure:`, {
        imgSrc: img.getAttribute('src').substring(0, 50) + '...',
        annotation: annotation
      });
      
      
      // 如果figure包含alt/annotation：annotation如果包含"图/figure/fig/Figure/Fig"，可行，选中返回
      if (annotation && patternFigure.test(annotation)) {
        // 3. 排除一些非法图片：如果figure annotation包含表/公式字段的图片不选择
        if (!containsTableOrFormula(annotation)) {
          console.log('匹配成功！通过annotation');
          return img.getAttribute('src');
        }
      }
      
      // 如果figure的annotation不匹配"图x"模式，则检查紧邻的邻居<p>节点或者文本节点
      if (!annotation || !patternFigure.test(annotation)) {
        const neighborText = getNeighborText(fig);
        console.log(`第${i+1}个figure的邻居文本:`, neighborText);
        if (neighborText && patternFigure.test(neighborText)) {
          // 3. 排除一些非法图片：如果邻居文本包含表/公式字段的图片不选择
          if (!containsTableOrFormula(neighborText)) {
            console.log('匹配成功！通过邻居文本:', neighborText.substring(0, 50));
            console.log('返回的图片src:', img.getAttribute('src').substring(0, 50) + '...');
            return img.getAttribute('src');
          } else {
            console.log('被表/公式字段过滤掉了:', neighborText.substring(0, 50));
          }
        }
      }
    }

    // 4. 如果最终没找到合适的图，重新过滤一遍全部图，返回不包含表/公式字段的第一张图
    for (const fig of figures) {
      const img = fig.querySelector('img[src]');
      if (!img) continue;
      
      const annotation = getFigureAnnotation(fig);
      const neighborText = getNeighborText(fig);
      const allText = (annotation + ' ' + neighborText).trim();
      
      // 排除包含表/公式字段的图片
      if (!containsTableOrFormula(allText)) {
        return img.getAttribute('src');
      }
    }

    // 2) img 邻近文本或 alt/title（按文档顺序）
    const imgs = Array.from(content.querySelectorAll('img[src]'));
    for (const img of imgs) {
      const alt = (img.getAttribute('alt') || '').trim();
      const title = (img.getAttribute('title') || '').trim();
      const src = (img.getAttribute('src') || '').trim();
      const baseHint = (alt + ' ' + title);
      if (isFormulaText(baseHint) || isTableLikeSrc(src)) continue;

      const neighbors = collectNeighbors(img, 3)
        .concat(collectNeighbors(img.parentElement, 3))
        .concat(collectNeighbors(img.parentElement ? img.parentElement.parentElement : null, 3));
      const contextTexts = [alt, title].concat(neighbors.map(n => (n.textContent||'').trim()));
      const anyTable = contextTexts.some(isTableText);
      const anyFigure = contextTexts.some(isFigureText);
      if (!anyTable && anyFigure) {
        return img.getAttribute('src');
      }
    }

    // 3) 段首"图1/Figure 1/Fig. 1" → 回溯至上一个 <img> 或 <figure>
    const paras = Array.from(content.querySelectorAll('p'));
    const headPattern = /^(图\s*\d+|figure\s*\d+|fig\.?\s*\d+)/i;
    for (const p of paras) {
      const t = (p.textContent || '').trim();
      if (headPattern.test(t) && !containsTableOrFormula(t)) {
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
              if (!containsTableOrFormula(hint)) {
                console.log('通过段落回溯找到figure中的图片:', src.substring(0, 50) + '...');
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
            if (!containsTableOrFormula(hint)) {
              console.log('通过段落回溯找到图片:', src.substring(0, 50) + '...');
              return src;
            }
          }
          prev = prev.previousElementSibling;
        }
      }
    }
    
    // 5. 如果还是不能，返回一个打印ASCII PaperCache的图片
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
      
      <!-- PaperCache ASCII Art -->
      <text x="200" y="35" font-family="monospace" font-size="8" text-anchor="middle" fill="#667eea">██████╗  █████╗ ██████╗ ███████╗██████╗  ██████╗ ██████╗ █████╗ ███████╗███████╗</text>
      <text x="200" y="45" font-family="monospace" font-size="8" text-anchor="middle" fill="#667eea">██╔══██╗██╔══██╗██╔══██╗██╔════╝██╔══██╗██╔════╝██╔═══██╗██╔══██╗██╔════╝██╔════╝</text>
      <text x="200" y="55" font-family="monospace" font-size="8" text-anchor="middle" fill="#667eea">██████╔╝███████║██████╔╝█████╗  ██████╔╝██║     ██║   ██║███████║█████╗  █████╗  </text>
      <text x="200" y="65" font-family="monospace" font-size="8" text-anchor="middle" fill="#667eea">██╔═══╝ ██╔══██║██╔═══╝ ██╔══╝  ██╔══██╗██║     ██║   ██║██╔══██║██╔══╝  ██╔══╝  </text>
      <text x="200" y="75" font-family="monospace" font-size="8" text-anchor="middle" fill="#667eea">██║     ██║  ██║██║     ███████╗██║  ██║╚██████╗╚██████╔╝██║  ██║███████╗███████╗</text>
      <text x="200" y="85" font-family="monospace" font-size="8" text-anchor="middle" fill="#667eea">╚═╝     ╚═╝  ╚═╝╚═╝     ╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝╚══════╝╚══════╝</text>
      
      <!-- 分隔线 -->
      <text x="200" y="100" font-family="monospace" font-size="8" text-anchor="middle" fill="#4a5568">────────────────────────────────────────────────────────────────────────────</text>
      
      <!-- 副标题 -->
      <text x="200" y="115" font-family="monospace" font-size="10" text-anchor="middle" fill="#4a5568">AI Research Papers Collection</text>
      <text x="200" y="130" font-family="monospace" font-size="8" text-anchor="middle" fill="#718096">No Image Available</text>
      
      <!-- 底部装饰 -->
      <text x="200" y="150" font-family="monospace" font-size="8" text-anchor="middle" fill="#4a5568">┌────────────────────────────────────────────────────────────────────────────┐</text>
      <text x="200" y="160" font-family="monospace" font-size="8" text-anchor="middle" fill="#4a5568">│  🤖 AI-Powered Paper Analysis & Caching System  │</text>
      <text x="200" y="170" font-family="monospace" font-size="8" text-anchor="middle" fill="#4a5568">└────────────────────────────────────────────────────────────────────────────┘</text>
    </svg>
    `;
    
    // 将SVG转换为base64 data URL
    const base64 = btoa(unescape(encodeURIComponent(svg)));
    const dataUrl = `data:image/svg+xml;base64,${base64}`;
    
    console.log('✅ ASCII艺术字生成完成，长度:', dataUrl.length);
    return dataUrl;
  }

  function collectNeighbors(el, range) {
    const out = [];
    if (!el) return out;
    let cur = el;
    for (let i = 0; i < range; i++) {
      cur = cur && cur.previousElementSibling;
      if (cur) out.push(cur);
    }
    cur = el;
    for (let i = 0; i < range; i++) {
      cur = cur && cur.nextElementSibling;
      if (cur) out.push(cur);
    }
    return out;
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


