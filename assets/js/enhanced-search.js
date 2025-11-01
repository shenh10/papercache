/**
 * Enhanced Search Component for PaperCache
 * 提供高级搜索功能，包括实时建议、过滤器和结果展示
 */

class EnhancedSearch {
  constructor(options = {}) {
    this.apiBase = options.apiBase || '/api';
    this.searchInput = options.searchInput || '#search-input';
    this.resultsContainer = options.resultsContainer || '#search-results';
    this.suggestionsContainer = options.suggestionsContainer || '#search-suggestions';
    this.filtersContainer = options.filtersContainer || '#search-filters';
    
    this.currentQuery = '';
    this.currentFilters = {};
    this.searchTimeout = null;
    this.isSearching = false;
    
    this.init();
  }

  init() {
    this.bindEvents();
    this.createSearchUI();
    this.loadPopularSearches();
  }

  bindEvents() {
    const searchInput = document.querySelector(this.searchInput);
    if (!searchInput) return;

    // 输入事件
    searchInput.addEventListener('input', (e) => {
      this.handleSearchInput(e.target.value);
    });

    // 键盘事件
    searchInput.addEventListener('keydown', (e) => {
      this.handleKeydown(e);
    });

    // 点击外部关闭建议
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-container')) {
        this.hideSuggestions();
      }
    });
  }

  createSearchUI() {
    const searchContainer = document.querySelector('.search-container') || this.createSearchContainer();
    
    // 创建搜索框
    if (!document.querySelector(this.searchInput)) {
      const searchInput = document.createElement('input');
      searchInput.type = 'text';
      searchInput.id = 'search-input';
      searchInput.placeholder = '搜索论文标题、内容、分类...';
      searchInput.className = 'search-input';
      searchContainer.appendChild(searchInput);
    }

    // 创建建议容器
    if (!document.querySelector(this.suggestionsContainer)) {
      const suggestionsDiv = document.createElement('div');
      suggestionsDiv.id = 'search-suggestions';
      suggestionsDiv.className = 'search-suggestions';
      searchContainer.appendChild(suggestionsDiv);
    }

    // 创建过滤器
    this.createFilters();

    // 创建结果容器
    if (!document.querySelector(this.resultsContainer)) {
      const resultsDiv = document.createElement('div');
      resultsDiv.id = 'search-results';
      resultsDiv.className = 'search-results';
      document.body.appendChild(resultsDiv);
    }

    this.addStyles();
  }

  createSearchContainer() {
    const container = document.createElement('div');
    container.className = 'search-container';
    document.body.appendChild(container);
    return container;
  }

  createFilters() {
    const filtersDiv = document.createElement('div');
    filtersDiv.id = 'search-filters';
    filtersDiv.className = 'search-filters';
    filtersDiv.innerHTML = `
      <div class="filter-group">
        <label>分类:</label>
        <select id="category-filter" multiple>
          <option value="">所有分类</option>
        </select>
      </div>
      <div class="filter-group">
        <label>年份:</label>
        <select id="year-filter">
          <option value="">所有年份</option>
        </select>
      </div>
      <div class="filter-group">
        <label>标签:</label>
        <select id="tag-filter" multiple>
          <option value="">所有标签</option>
        </select>
      </div>
      <div class="filter-group">
        <button id="clear-filters">清除过滤器</button>
      </div>
    `;

    document.querySelector('.search-container').appendChild(filtersDiv);
    this.loadFilterOptions();
  }

  async loadFilterOptions() {
    try {
      const response = await fetch(`${this.apiBase}/stats`);
      const stats = await response.json();

      // 加载分类选项
      const categorySelect = document.getElementById('category-filter');
      Object.keys(stats.categories).forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = `${category} (${stats.categories[category]})`;
        categorySelect.appendChild(option);
      });

      // 加载年份选项
      const yearSelect = document.getElementById('year-filter');
      Object.keys(stats.years).sort((a, b) => b - a).forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = `${year} (${stats.years[year]})`;
        yearSelect.appendChild(option);
      });

      // 加载标签选项
      const tagSelect = document.getElementById('tag-filter');
      Object.keys(stats.tags).forEach(tag => {
        const option = document.createElement('option');
        option.value = tag;
        option.textContent = `${tag} (${stats.tags[tag]})`;
        tagSelect.appendChild(option);
      });

      // 绑定过滤器事件
      this.bindFilterEvents();

    } catch (error) {
      console.error('Failed to load filter options:', error);
    }
  }

  bindFilterEvents() {
    const categoryFilter = document.getElementById('category-filter');
    const yearFilter = document.getElementById('year-filter');
    const tagFilter = document.getElementById('tag-filter');
    const clearButton = document.getElementById('clear-filters');

    [categoryFilter, yearFilter, tagFilter].forEach(filter => {
      filter.addEventListener('change', () => {
        this.updateFilters();
        this.performSearch();
      });
    });

    clearButton.addEventListener('click', () => {
      this.clearFilters();
    });
  }

  updateFilters() {
    const categoryFilter = document.getElementById('category-filter');
    const yearFilter = document.getElementById('year-filter');
    const tagFilter = document.getElementById('tag-filter');

    this.currentFilters = {
      categories: Array.from(categoryFilter.selectedOptions).map(opt => opt.value).filter(v => v),
      year: yearFilter.value,
      tags: Array.from(tagFilter.selectedOptions).map(opt => opt.value).filter(v => v)
    };

    // 添加日期范围
    if (this.currentFilters.year) {
      this.currentFilters.dateRange = {
        start: `${this.currentFilters.year}-01-01`,
        end: `${this.currentFilters.year}-12-31`
      };
    }
  }

  clearFilters() {
    document.getElementById('category-filter').selectedIndex = -1;
    document.getElementById('year-filter').selectedIndex = 0;
    document.getElementById('tag-filter').selectedIndex = -1;
    this.currentFilters = {};
    this.performSearch();
  }

  handleSearchInput(query) {
    this.currentQuery = query.trim();
    
    // 清除之前的搜索超时
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    if (this.currentQuery.length === 0) {
      this.hideSuggestions();
      this.clearResults();
      return;
    }

    if (this.currentQuery.length < 2) {
      return;
    }

    // 延迟搜索，避免频繁请求
    this.searchTimeout = setTimeout(() => {
      this.loadSuggestions();
      this.performSearch();
    }, 300);
  }

  async loadSuggestions() {
    try {
      const response = await fetch(`${this.apiBase}/suggestions?q=${encodeURIComponent(this.currentQuery)}&limit=8`);
      const data = await response.json();
      this.showSuggestions(data.suggestions);
    } catch (error) {
      console.error('Failed to load suggestions:', error);
    }
  }

  showSuggestions(suggestions) {
    const container = document.querySelector(this.suggestionsContainer);
    if (!container) return;

    if (suggestions.length === 0) {
      container.style.display = 'none';
      return;
    }

    container.innerHTML = suggestions.map(suggestion => `
      <div class="suggestion-item" data-type="${suggestion.type}" data-url="${suggestion.url}">
        <div class="suggestion-text">${suggestion.text}</div>
        ${suggestion.count ? `<div class="suggestion-count">${suggestion.count}</div>` : ''}
      </div>
    `).join('');

    // 绑定点击事件
    container.querySelectorAll('.suggestion-item').forEach(item => {
      item.addEventListener('click', () => {
        const url = item.dataset.url;
        if (url) {
          window.location.href = url;
        } else {
          document.querySelector(this.searchInput).value = item.querySelector('.suggestion-text').textContent;
          this.performSearch();
        }
        this.hideSuggestions();
      });
    });

    container.style.display = 'block';
  }

  hideSuggestions() {
    const container = document.querySelector(this.suggestionsContainer);
    if (container) {
      container.style.display = 'none';
    }
  }

  async performSearch() {
    if (this.isSearching || !this.currentQuery) return;

    this.isSearching = true;
    this.showLoading();

    try {
      const response = await fetch(`${this.apiBase}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: this.currentQuery,
          filters: this.currentFilters,
          limit: 50
        })
      });

      const data = await response.json();
      this.showResults(data);
    } catch (error) {
      console.error('Search failed:', error);
      this.showError('搜索失败，请稍后重试');
    } finally {
      this.isSearching = false;
      this.hideLoading();
    }
  }

  showResults(data) {
    const container = document.querySelector(this.resultsContainer);
    if (!container) return;

    if (data.results.length === 0) {
      container.innerHTML = `
        <div class="no-results">
          <h3>未找到相关论文</h3>
          <p>尝试使用不同的关键词或调整过滤器</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="search-header">
        <h3>搜索结果 (${data.total} 篇论文)</h3>
        <div class="search-query">搜索: "${data.query}"</div>
      </div>
      <div class="search-results-list">
        ${data.results.map(paper => this.renderPaperCard(paper)).join('')}
      </div>
    `;

    // 绑定论文卡片事件
    container.querySelectorAll('.paper-card').forEach(card => {
      card.addEventListener('click', () => {
        window.location.href = card.dataset.url;
      });
    });
  }

  renderPaperCard(paper) {
    return `
      <div class="paper-card" data-url="${paper.url}">
        <div class="paper-title">${paper.title}</div>
        <div class="paper-meta">
          <span class="paper-date">${new Date(paper.date).toLocaleDateString()}</span>
          <span class="paper-categories">${paper.categories.join(' / ')}</span>
          ${paper.tag ? `<span class="paper-tag">${paper.tag}</span>` : ''}
        </div>
        ${paper.excerpt ? `<div class="paper-excerpt">${paper.excerpt.substring(0, 200)}...</div>` : ''}
        <div class="paper-score">相关度: ${Math.round(paper.score * 100)}%</div>
      </div>
    `;
  }

  showLoading() {
    const container = document.querySelector(this.resultsContainer);
    if (container) {
      container.innerHTML = '<div class="loading">搜索中...</div>';
    }
  }

  hideLoading() {
    // 加载状态会在 showResults 中被替换
  }

  showError(message) {
    const container = document.querySelector(this.resultsContainer);
    if (container) {
      container.innerHTML = `<div class="error">${message}</div>`;
    }
  }

  clearResults() {
    const container = document.querySelector(this.resultsContainer);
    if (container) {
      container.innerHTML = '';
    }
  }

  async loadPopularSearches() {
    try {
      const response = await fetch(`${this.apiBase}/suggestions?limit=10`);
      const data = await response.json();
      
      if (data.suggestions && data.suggestions.length > 0) {
        this.showPopularSearches(data.suggestions);
      }
    } catch (error) {
      console.error('Failed to load popular searches:', error);
    }
  }

  showPopularSearches(suggestions) {
    // 可以在搜索框下方显示热门搜索
    console.log('Popular searches:', suggestions);
  }

  handleKeydown(e) {
    if (e.key === 'Escape') {
      this.hideSuggestions();
    }
  }

  addStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .search-container {
        position: relative;
        max-width: 600px;
        margin: 20px auto;
      }
      
      .search-input {
        width: 100%;
        padding: 12px 16px;
        border: 2px solid #ddd;
        border-radius: 8px;
        font-size: 16px;
        outline: none;
        transition: border-color 0.3s;
      }
      
      .search-input:focus {
        border-color: #007bff;
      }
      
      .search-suggestions {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: white;
        border: 1px solid #ddd;
        border-top: none;
        border-radius: 0 0 8px 8px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        z-index: 1000;
        display: none;
      }
      
      .suggestion-item {
        padding: 12px 16px;
        cursor: pointer;
        border-bottom: 1px solid #eee;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .suggestion-item:hover {
        background-color: #f8f9fa;
      }
      
      .suggestion-count {
        color: #666;
        font-size: 12px;
      }
      
      .search-filters {
        margin: 20px 0;
        padding: 20px;
        background: #f8f9fa;
        border-radius: 8px;
        display: flex;
        gap: 20px;
        flex-wrap: wrap;
        align-items: center;
      }
      
      .filter-group {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }
      
      .filter-group label {
        font-weight: bold;
        font-size: 14px;
      }
      
      .filter-group select {
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
        min-width: 150px;
      }
      
      .search-results {
        margin-top: 20px;
      }
      
      .search-header {
        margin-bottom: 20px;
        padding-bottom: 10px;
        border-bottom: 2px solid #eee;
      }
      
      .search-query {
        color: #666;
        font-size: 14px;
        margin-top: 5px;
      }
      
      .paper-card {
        padding: 20px;
        margin-bottom: 15px;
        border: 1px solid #eee;
        border-radius: 8px;
        cursor: pointer;
        transition: box-shadow 0.3s;
      }
      
      .paper-card:hover {
        box-shadow: 0 4px 8px rgba(0,0,0,0.1);
      }
      
      .paper-title {
        font-size: 18px;
        font-weight: bold;
        color: #333;
        margin-bottom: 10px;
      }
      
      .paper-meta {
        display: flex;
        gap: 15px;
        margin-bottom: 10px;
        font-size: 14px;
        color: #666;
      }
      
      .paper-tag {
        background: #007bff;
        color: white;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 12px;
      }
      
      .paper-excerpt {
        color: #666;
        line-height: 1.5;
        margin-bottom: 10px;
      }
      
      .paper-score {
        font-size: 12px;
        color: #999;
      }
      
      .loading, .error, .no-results {
        text-align: center;
        padding: 40px;
        color: #666;
      }
      
      .error {
        color: #dc3545;
      }
    `;
    document.head.appendChild(style);
  }
}

// 自动初始化
document.addEventListener('DOMContentLoaded', () => {
  window.enhancedSearch = new EnhancedSearch();
});

// 导出供外部使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EnhancedSearch;
}

