// 防止重复初始化的search-first脚本
(function(){
  // 检查是否已经初始化过
  if (window.searchFirstInitialized) {
    console.log('[search-first] already initialized, skipping');
    return;
  }

  function log(){try{console.log.apply(console,['[search-first]'].concat([].slice.call(arguments)));}catch(e){}}
  function qs(s){return document.querySelector(s);} function qsa(s){return Array.prototype.slice.call(document.querySelectorAll(s));}
  function pathWithoutBase(p){try{if(!p) return p; if(!p.startsWith('/')) p='/'+p; var seg=p.split('/'); if(seg.length>2){ return '/'+seg.slice(2).join('/');} return p;}catch(e){return p;}}
  function normUrl(u){try{var a=document.createElement('a');a.href=u;var p=a.pathname||u; if(!p.startsWith('/')) p='/'+p; var cands=[p]; cands.push(pathWithoutBase(p)); if(p.endsWith('/')) {cands.push(p.replace(/\/$/,'/index.html')); cands.push(pathWithoutBase(p.replace(/\/$/,'/index.html')));} if(!/\.html?$/.test(p)) {cands.push(p + '.html'); cands.push(pathWithoutBase(p + '.html'));} return Array.from(new Set(cands)); }catch(e){return [u];}}
  function getThumb(u){var m=window.PC_THUMBS||{};var fb=window.PC_THUMB_FALLBACK||'/assets/images/fallback-paper.svg';var c=normUrl(u);for(var i=0;i<c.length;i++){if(m[c[i]]) return m[c[i]];}for(var i=0;i<c.length;i++){if(!c[i].startsWith('/papers/')){var pc='/papers'+c[i];if(m[pc]) return m[pc];}}return fb;}
  function chooseTag(p){ var candidates=[].concat(p.tags||[]); if(!candidates.length && p.categories && p.categories.length) candidates.push(p.categories[p.categories.length-1]); var tag=(candidates[0]||'').toString(); if(!tag && p.categories && p.categories.join(' ').toLowerCase().indexOf('arxiv')!==-1) tag='arXiv'; return tag; }
  function arxivClass(tag){return (tag||'').toLowerCase().indexOf('arxiv')!==-1 ? ' tag-arxiv' : '';}
  function performLocalSearch(query, all){var q=(query||'').trim().toLowerCase();if(!q)return[];var t=q.split(/\s+/).filter(Boolean);return(all||[]).filter(function(p){var h=(p.title+' '+p.excerpt+' '+(p.tags||[]).join(' ')+' '+(p.categories||[]).join(' ')).toLowerCase();return t.every(function(x){return h.indexOf(x)!==-1;});});}
  function renderResults(items){var box=qs('#results-list'),count=qs('#results-count'),sec=qs('#search-results');if(!box||!count||!sec){log('missing results container', {box:!!box,count:!!count,sec:!!sec});return;}
    // 强制网格可见
    box.classList.add('post-grid-modern');
    box.style.display='grid';
    box.style.gridTemplateColumns='repeat(auto-fill, minmax(300px, 1fr))';
    box.style.gap='20px';
    box.innerHTML='';

    // 添加收藏按钮样式（如果还没有添加）
    if (!document.getElementById('favorite-btn-styles')) {
      var style = document.createElement('style');
      style.id = 'favorite-btn-styles';
      style.textContent = '\
        .post-card-meta-modern {\
          display: flex;\
          align-items: center;\
          justify-content: space-between;\
          gap: 8px;\
          flex-wrap: nowrap;\
        }\
        .post-card-meta-modern .post-meta-modern {\
          flex: 1;\
        }\
        .post-card-meta-right {\
          display: flex;\
          align-items: center;\
          gap: 0.5rem;\
          margin-left: auto;\
          flex-shrink: 0;\
        }\
        .post-card-meta-modern .post-card-tag-modern {\
          flex-shrink: 0;\
        }\
        .card-favorite-btn {\
          background: transparent;\
          border: none;\
          cursor: pointer;\
          padding: 0;\
          border-radius: 50%;\
          transition: all 0.2s ease;\
          display: inline-flex;\
          align-items: center;\
          justify-content: center;\
          width: 28px;\
          height: 28px;\
          flex-shrink: 0;\
        }\
        .card-favorite-btn:hover {\
          background: rgba(251, 191, 36, 0.1);\
          transform: scale(1.1);\
        }\
        .card-favorite-btn:active {\
          transform: scale(0.95);\
        }\
        .card-favorite-btn.favorited {\
          background: rgba(251, 191, 36, 0.1);\
        }\
        .card-favorite-btn.favorited:hover {\
          background: rgba(251, 191, 36, 0.15);\
        }\
        .card-favorite-btn .favorite-icon {\
          font-size: 1.2rem;\
          line-height: 1;\
          transition: all 0.2s ease;\
          color: #9ca3af;\
        }\
        .card-favorite-btn:hover .favorite-icon {\
          color: #fbbf24;\
          transform: scale(1.1);\
        }\
        .card-favorite-btn.favorited .favorite-icon {\
          color: #fbbf24;\
        }\
        .card-favorite-btn.clicked {\
          transform: scale(1.1);\
        }\
        .card-favorite-btn.clicked .favorite-icon {\
          animation: starPulse 0.4s ease;\
        }\
        @keyframes starPulse {\
          0%, 100% { transform: scale(1); }\
          50% { transform: scale(1.3); }\
        }\
      ';
      document.head.appendChild(style);
    }
    count.textContent=(items||[]).length+'篇';
    sec.classList.add('show');
    sec.style.display='block';
    if(!items||!items.length){box.innerHTML='<div style="text-align:center;padding:40px;color:#6b7280"><h3>未找到相关论文</h3><p>尝试使用不同的关键词或浏览分类</p></div>';log('rendered empty');return;}
    items.forEach(function(p){var d=document.createElement('div');d.className='post-card-modern';var thumb=getThumb(p.url);var tag=chooseTag(p);var escapedUrl=(p.url||'#').replace(/'/g,"\\'");d.innerHTML='\n<a href="'+(p.url||'#')+'" class="post-card-link-modern">\n  <div class="post-card-thumb-modern">\n    <img src="'+thumb+'" alt="thumb" loading="lazy" />\n  </div>\n  <div class="post-card-body-modern">\n    <div class="post-card-meta-modern">\n      <span class="post-meta-modern">'+new Date().toLocaleDateString()+'</span>\n      <div class="post-card-meta-right">\n        '+(tag?('<span class="post-card-tag-modern'+arxivClass(tag)+'">'+tag+'</span>'):'')+'\n        <button class="card-favorite-btn"\n                data-post-url="'+(p.url||'#')+'"\n                onclick="event.stopPropagation(); event.preventDefault(); handleCardFavoriteClick(\''+escapedUrl+'\', this);"\n                title="收藏这篇文章">\n          <span class="favorite-icon">☆</span>\n          <span class="favorite-count" data-post-url="'+(p.url||'#')+'">0</span>\n        </button>\n      </div>\n    </div>\n    <h3 class="post-card-title-modern">'+(p.title||'')+'</h3>\n    <p class="post-card-excerpt-modern">'+(p.excerpt||'')+'</p>\n  </div>\n</a>\n';

    // 收藏按钮状态将在批量检查时更新，这里不单独检查以提高性能
    
    box.appendChild(d);});
    log('rendered cards:', box.childElementCount);
    
    // 批量检查收藏状态（已登录用户）
    if (window.favoritesService && window.SimpleAuth && window.SimpleAuth.isLoggedIn()) {
      setTimeout(() => {
        batchUpdateFavoriteStatusForCards(box);
      }, 100);
    }
    
    try{sec.scrollIntoView({behavior:'smooth', block:'start'});}catch(e){}
  }
  
  // 批量更新卡片收藏状态
  async function batchUpdateFavoriteStatusForCards(container) {
    try {
      const allCards = container.querySelectorAll('.card-favorite-btn');
      if (allCards.length === 0) return;
      
      const postUrls = Array.from(allCards).map(btn => {
        return btn.getAttribute('data-post-url');
      }).filter(url => url && url !== '#');
      
      if (postUrls.length === 0) return;
      
      const favoritesMap = await window.favoritesService.batchCheckFavorites(postUrls);
      
      allCards.forEach(btn => {
        const postUrl = btn.getAttribute('data-post-url');
        if (!postUrl || postUrl === '#') return;
        
        const icon = btn.querySelector('.favorite-icon');
        if (!icon) return;
        
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
      });
    } catch (error) {
      log('批量更新收藏状态失败:', error);
    }
  }
  function getAllPosts(){var d=window.PAPERCACHE_POSTS||[];if(!Array.isArray(d)){log('PAPERCACHE_POSTS not array');return [];}return d;}
  function showResults(list){ var quick=qs('.quick-browse-section'); if(quick) quick.style.display='none'; var sec=qs('#search-results'); if(sec){ sec.style.display='block'; sec.classList.add('show'); } renderResults(list||[]); }
  function doSearch(){var input=qs('#main-search-input');if(!input){return;}var q=input.value||'';if(q.trim().length<2){return;}
    // 如果有 SearchFirstMode 实例，使用它的搜索方法（支持分组显示）
    if(window.searchFirstMode && typeof window.searchFirstMode.performSearch === 'function'){
      window.searchFirstMode.performSearch();
      return;
    }
    // 否则使用原来的搜索逻辑（作为降级）
    var all=getAllPosts();var local=performLocalSearch(q,all);if(local.length===0){showResults(all.slice(0,10));} else {showResults(local);}try{fetch('/api/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:q})}).then(function(r){if(!r.ok)throw new Error('bad status');return r.json();}).then(function(data){var arr=Array.isArray(data&&data.results)?data.results:[];if(arr.length){var mapped=arr.map(function(r){return{title:r.title||r.name||'Untitled',excerpt:r.excerpt||r.summary||'',url:r.url||r.link||'#',tags:r.tags||[],categories:r.categories||[]};});showResults(mapped);}}).catch(function(e){});}catch(e){} }
  function bind(){log('bind start');
    var btn=qs('#search-btn'); if(btn)btn.addEventListener('click',doSearch);
    qsa('.suggestion-item').forEach(function(el){ var q=el.getAttribute('data-query')||el.textContent||''; el.setAttribute('data-query', q); el.addEventListener('click', function(){ var input=qs('#main-search-input'); if(input) input.value=q; doSearch(); });});
    // "浏览所有论文"按钮由 HTML 内联的 SearchFirstMode 类处理，这里不再绑定
    // var allBtn=qs('#browse-all-btn'); // 由内联脚本处理
    // 分类卡片点击事件由 HTML 内联的 SearchFirstMode 类处理，这里不再绑定
    // 避免事件冲突，让内联脚本（collection-search-first.html）处理分类浏览
    var backBtn=qs('#back-to-search-btn'); if(backBtn){ backBtn.addEventListener('click', function(){ var quick=qs('.quick-browse-section'); if(quick) quick.style.display='block'; var sec=qs('#search-results'); if(sec){ sec.style.display='none'; } }); }
    window.__pc_search=doSearch;
  }

  // 标记为已初始化
  window.searchFirstInitialized = true;

  // 处理卡片收藏按钮点击
  window.handleCardFavoriteClick = async function(postUrl, button) {
    if (!window.favoritesService) {
      alert('收藏功能不可用，请刷新页面重试');
      return;
    }

    // 检查用户登录状态
    const isLoggedIn = window.SimpleAuth && window.SimpleAuth.isLoggedIn();
    
    if (!isLoggedIn) {
      // 未登录，弹出登录窗口
      if (window.openAuthModal) {
        window.openAuthModal('login');
      } else {
        alert('请先登录后再收藏文章');
      }
      return;
    }

    // 已登录，切换收藏状态
    const icon = button.querySelector('.favorite-icon');
    if (!icon) {
      console.error('Favorite icon not found');
      return;
    }

    // 显示加载状态
    button.disabled = true;

    try {
      const result = await window.favoritesService.toggleFavorite(postUrl);

      if (result.success) {
        // 更新UI
        if (result.favorited) {
          button.classList.add('favorited');
          icon.textContent = '★';
          icon.style.color = '#fbbf24';
        } else {
          button.classList.remove('favorited');
          icon.textContent = '☆';
          icon.style.color = '#9ca3af';
        }
        
        // 更新收藏数
        const countEl = button.querySelector('.favorite-count');
        if (countEl && window.favoritesService) {
          const countResult = await window.favoritesService.getPostFavoriteCount(postUrl);
          if (countResult.success) {
            countEl.textContent = countResult.count > 0 ? countResult.count : '0';
          }
        }
        
        // 显示收藏成功提示
        if (result.favorited) {
          showFavoriteToast('已添加到收藏');
        } else {
          showFavoriteToast('已取消收藏');
        }

        // 添加点击动画
        button.classList.add('clicked');
        setTimeout(() => {
          button.classList.remove('clicked');
        }, 600);
      } else {
        if (result.error === '请先登录') {
          // 如果登录状态检查失败，弹出登录窗口
          if (window.openAuthModal) {
            window.openAuthModal('login');
          } else {
            alert('请先登录后再收藏文章');
          }
        } else {
          alert('操作失败：' + (result.error || '未知错误'));
        }
      }
    } catch (error) {
      console.error('收藏操作失败:', error);
      alert('收藏失败，请重试');
    } finally {
      button.disabled = false;
    }
  };

  // 显示收藏提示消息
  function showFavoriteToast(message) {
    // 创建提示元素
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%) translateY(-20px);
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      font-size: 14px;
      font-weight: 500;
      opacity: 0;
      transition: all 0.3s ease;
      pointer-events: none;
      white-space: nowrap;
    `;
    toast.textContent = message;

    document.body.appendChild(toast);

    // 显示动画
    setTimeout(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(-50%) translateY(0)';
    }, 10);

    // 自动隐藏
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(-20px)';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 2000);
  }

  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',bind);}else{bind();}
  
  // Turbolinks页面加载时重新绑定事件
  document.addEventListener('turbolinks:load', function() {
    console.log('[search-first] Turbolinks load, rebinding events');
    bind();
  });
})();
