(function(){
  function log(){try{console.log.apply(console,['[search-first]'].concat([].slice.call(arguments)));}catch(e){}}
  function qs(s){return document.querySelector(s);} function qsa(s){return Array.prototype.slice.call(document.querySelectorAll(s));}
  function pathWithoutBase(p){try{if(!p) return p; if(!p.startsWith('/')) p='/'+p; var seg=p.split('/'); if(seg.length>2){ return '/'+seg.slice(2).join('/');} return p;}catch(e){return p;}}
  function normUrl(u){try{var a=document.createElement('a');a.href=u;var p=a.pathname||u; if(!p.startsWith('/')) p='/'+p; var cands=[p]; cands.push(pathWithoutBase(p)); if(p.endsWith('/')) {cands.push(p.replace(/\/$/,'/index.html')); cands.push(pathWithoutBase(p.replace(/\/$/,'/index.html')));} if(!/\.html?$/.test(p)) {cands.push(p + '.html'); cands.push(pathWithoutBase(p + '.html'));} return Array.from(new Set(cands)); }catch(e){return [u];}}
  function getThumb(u){var m=window.PC_THUMBS||{};var fb=window.PC_THUMB_FALLBACK||'/assets/images/fallback-paper.svg';var c=normUrl(u);for(var i=0;i<c.length;i++){if(m[c[i]]) return m[c[i]];}return fb;}
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
    count.textContent=(items||[]).length+'篇';
    sec.classList.add('show');
    sec.style.display='block';
    if(!items||!items.length){box.innerHTML='<div style="text-align:center;padding:40px;color:#6b7280"><h3>未找到相关论文</h3><p>尝试使用不同的关键词或浏览分类</p></div>';log('rendered empty');return;}
    items.forEach(function(p){var d=document.createElement('div');d.className='post-card-modern';var thumb=getThumb(p.url);var tag=chooseTag(p);d.innerHTML='\n<a href="'+(p.url||'#')+'" class="post-card-link-modern">\n  <div class="post-card-thumb-modern">\n    <img src="'+thumb+'" alt="thumb" loading="lazy" />\n  </div>\n  <div class="post-card-body-modern">\n    <div class="post-card-meta-modern">\n      <span class="post-meta-modern">'+new Date().toLocaleDateString()+'</span>\n      '+(tag?('<span class="post-card-tag-modern'+arxivClass(tag)+'">'+tag+'</span>'):'')+'\n    </div>\n    <h3 class="post-card-title-modern">'+(p.title||'')+'</h3>\n    <p class="post-card-excerpt-modern">'+(p.excerpt||'')+'</p>\n  </div>\n</a>\n';box.appendChild(d);});
    log('rendered cards:', box.childElementCount);
    try{sec.scrollIntoView({behavior:'smooth', block:'start'});}catch(e){}
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
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',bind);}else{bind();}
})();
