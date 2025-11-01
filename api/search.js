import fs from 'fs';
import path from 'path';
import { parse } from 'yaml';

// lunr 可能需要使用动态导入或 createRequire
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const lunr = require('lunr');

// 全局变量缓存搜索索引
let searchIndex = null;
let papersData = null;

// 初始化搜索索引
async function initializeSearchIndex() {
  if (searchIndex && papersData) {
    return { searchIndex, papersData };
  }

  try {
    // 读取论文数据
    const collectionPath = path.join(process.cwd(), '_data', 'collection_structure.yml');
    const excerptsPath = path.join(process.cwd(), 'assets', 'data', 'excerpts.json');
    
    // 检查文件是否存在
    if (!fs.existsSync(collectionPath) || !fs.existsSync(excerptsPath)) {
      throw new Error('Data files not found');
    }

    const collectionData = parse(fs.readFileSync(collectionPath, 'utf8'));
    const excerptsData = JSON.parse(fs.readFileSync(excerptsPath, 'utf8'));

    // 提取所有论文数据
    papersData = [];
    function extractPapers(node, categories = []) {
      if (node.posts && Array.isArray(node.posts)) {
        node.posts.forEach(post => {
          const paper = {
            id: post.url,
            title: post.title,
            url: post.url,
            date: post.date,
            categories: post.categories || categories,
            tag: post.tag || '',
            excerpt: excerptsData[post.url] || ''
          };
          papersData.push(paper);
        });
      }
      
      if (typeof node === 'object' && node !== null) {
        Object.keys(node).forEach(key => {
          if (key !== 'posts' && typeof node[key] === 'object') {
            extractPapers(node[key], [...categories, key]);
          }
        });
      }
    }

    extractPapers(collectionData);

    // 构建 Lunr 搜索索引
    searchIndex = lunr(function () {
      this.field('title', { boost: 10 });
      this.field('excerpt', { boost: 5 });
      this.field('categories', { boost: 3 });
      this.field('tag', { boost: 2 });
      this.ref('id');

      papersData.forEach(paper => {
        this.add(paper);
      });
    });

    console.log(`Search index initialized with ${papersData.length} papers`);
    return { searchIndex, papersData };

  } catch (error) {
    console.error('Failed to initialize search index:', error);
    throw error;
  }
}

// 中英文关键词映射，支持混合搜索
function expandQuery(query) {
  const keywordMap = {
    'gpu优化': 'gpu optimization',
    'gpu': 'gpu',
    '优化': 'optimization optimize efficient',
    '分布式': 'distributed parallel cluster',
    '系统': 'system architecture framework',
    '注意力': 'attention transformer',
    '机制': 'mechanism method approach',
    '性能': 'performance efficient optimization'
  };
  
  let expandedQuery = query.toLowerCase();
  
  // 替换中文关键词为对应的英文关键词
  for (const [chinese, english] of Object.entries(keywordMap)) {
    if (expandedQuery.includes(chinese)) {
      expandedQuery = expandedQuery.replace(new RegExp(chinese, 'gi'), english);
    }
  }
  
  return expandedQuery;
}

// 精确匹配函数
function performExactMatch(query, searchFields = ['title', 'excerpt'], papersData) {
  const queryLower = query.toLowerCase();
  const results = [];
  
  papersData.forEach(paper => {
    let score = 0;
    let matched = false;
    
    // 在指定字段中进行精确匹配
    if (searchFields.includes('title') && paper.title) {
      const titleLower = paper.title.toLowerCase();
      if (titleLower.includes(queryLower)) {
        score += 10; // 标题匹配权重最高
        matched = true;
        // 如果完全匹配标题，给予更高分数
        if (titleLower === queryLower) {
          score += 20;
        }
      }
    }
    
    if (searchFields.includes('excerpt') && paper.excerpt) {
      const excerptLower = paper.excerpt.toLowerCase();
      if (excerptLower.includes(queryLower)) {
        score += 5;
        matched = true;
      }
    }
    
    // 全文搜索（如果提供了全文内容）
    if (searchFields.includes('fulltext')) {
      // 组合所有文本内容进行搜索
      const fullText = [
        paper.title || '',
        paper.excerpt || '',
        paper.categories ? paper.categories.join(' ') : '',
        paper.tag || ''
      ].join(' ').toLowerCase();
      
      if (fullText.includes(queryLower)) {
        // 全文匹配分数较低，因为范围更广
        score += 1;
        matched = true;
        // 如果匹配了标题或摘要，已经在上面加分了，这里不再重复
      }
    }
    
    if (searchFields.includes('categories') && paper.categories) {
      const categoriesStr = paper.categories.join(' ').toLowerCase();
      if (categoriesStr.includes(queryLower)) {
        score += 3;
        matched = true;
      }
    }
    
    if (searchFields.includes('tag') && paper.tag) {
      const tagLower = paper.tag.toLowerCase();
      if (tagLower.includes(queryLower)) {
        score += 2;
        matched = true;
      }
    }
    
    if (matched) {
      results.push({
        ref: paper.id,
        score: score
      });
    }
  });
  
  // 按分数降序排序
  return results.sort((a, b) => b.score - a.score);
}

// 搜索函数 - 支持精确匹配和模糊匹配
function performSearch(query, filters = {}, matchMode = 'fuzzy', searchFields = ['title', 'excerpt']) {
  if (!searchIndex || !papersData) {
    throw new Error('Search index not initialized');
  }
  
  let results = [];
  
  // 如果查询为空，返回所有论文（之后会应用过滤器）
  if (!query || query.trim() === '') {
    // 返回所有论文，格式化为搜索结果格式
    results = papersData.map((paper, index) => ({
      ref: paper.id,
      score: 1.0 // 默认分数
    }));
  }
  // 精确匹配模式
  else if (matchMode === 'exact') {
    results = performExactMatch(query, searchFields, papersData);
  } 
  // 模糊匹配模式（默认）- 使用 Lunr 全文搜索，不使用搜索范围限制
  else {
    // 扩展查询，支持中英文混合搜索
    const expandedQuery = expandQuery(query);
    results = searchIndex.search(expandedQuery);
    
    // 如果扩展后的查询没有结果，尝试使用原始查询
    if (results.length === 0) {
      results = searchIndex.search(query);
    }
  }
  
  // 应用过滤器
  if (filters.categories && filters.categories.length > 0) {
    results = results.filter(result => {
      const paper = papersData.find(p => p.id === result.ref);
      return paper && paper.categories.some(cat => filters.categories.includes(cat));
    });
  }

  if (filters.dateRange) {
    const { start, end } = filters.dateRange;
    results = results.filter(result => {
      const paper = papersData.find(p => p.id === result.ref);
      if (!paper) return false;
      const paperDate = new Date(paper.date);
      return paperDate >= new Date(start) && paperDate <= new Date(end);
    });
  }

  if (filters.tags && filters.tags.length > 0) {
    results = results.filter(result => {
      const paper = papersData.find(p => p.id === result.ref);
      return paper && filters.tags.some(tag => paper.tag === tag);
    });
  }

  // 返回完整的论文信息
  return results.map(result => {
    const paper = papersData.find(p => p.id === result.ref);
    return {
      ...paper,
      score: result.score
    };
  });
}

// 获取搜索建议
function getSuggestions(query, limit = 5) {
  if (!papersData) return [];
  
  const suggestions = [];
  const queryLower = query.toLowerCase();
  
  // 从标题中提取建议
  papersData.forEach(paper => {
    if (paper.title.toLowerCase().includes(queryLower)) {
      suggestions.push({
        type: 'title',
        text: paper.title,
        url: paper.url
      });
    }
  });

  // 从分类中提取建议
  const categories = new Set();
  papersData.forEach(paper => {
    paper.categories.forEach(cat => {
      if (cat.toLowerCase().includes(queryLower)) {
        categories.add(cat);
      }
    });
  });

  categories.forEach(cat => {
    suggestions.push({
      type: 'category',
      text: cat,
      url: `/papers/${cat.toLowerCase()}`
    });
  });

  return suggestions.slice(0, limit);
}

// API 处理函数
export default async function handler(req, res) {
  // OPTIONS 请求（CORS 预检）必须最先处理，立即返回
  // 使用 .end() 而不是 .json() 以避免潜在的序列化错误
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(200).end();
    return;
  }

  // 设置 CORS 头 - 必须在任何响应之前设置
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  try {
    // 初始化搜索索引
    await initializeSearchIndex();

    const { method } = req;

    if (method === 'GET') {
      // 基础搜索
      const { q, category, dateStart, dateEnd, tag, limit = 20 } = req.query;
      
      if (!q) {
        return res.status(400).json({ error: 'Query parameter "q" is required' });
      }

      const filters = {};
      if (category) filters.categories = Array.isArray(category) ? category : [category];
      if (dateStart && dateEnd) filters.dateRange = { start: dateStart, end: dateEnd };
      if (tag) filters.tags = Array.isArray(tag) ? tag : [tag];

      const results = performSearch(q, filters);
      const limitedResults = results.slice(0, parseInt(limit));

      res.status(200).json({
        query: q,
        total: results.length,
        results: limitedResults,
        filters: filters
      });

    } else if (method === 'POST') {
      // 高级搜索
      const { 
        query = '', 
        filters = {}, 
        limit = 20,
        matchMode = 'fuzzy', // 'exact' 或 'fuzzy'
        searchFields = ['title', 'excerpt'] // ['title', 'excerpt', 'categories', 'tag']
      } = req.body;
      
      // 如果查询为空，必须至少有tag过滤或其他过滤器
      if (!query && (!filters.tags || filters.tags.length === 0)) {
        return res.status(400).json({ error: 'Query is required when no filters are provided' });
      }
      
      // 验证 matchMode
      if (matchMode !== 'exact' && matchMode !== 'fuzzy') {
        return res.status(400).json({ error: 'matchMode must be "exact" or "fuzzy"' });
      }
      
      // 只有当查询不为空时才需要验证searchFields
      if (query && query.trim()) {
        // 验证 searchFields
        const validFields = ['title', 'excerpt', 'fulltext', 'categories', 'tag'];
        if (!Array.isArray(searchFields) || searchFields.length === 0) {
          return res.status(400).json({ error: 'searchFields must be a non-empty array' });
        }
        const invalidFields = searchFields.filter(f => !validFields.includes(f));
        if (invalidFields.length > 0) {
          return res.status(400).json({ error: `Invalid searchFields: ${invalidFields.join(', ')}. Valid fields are: ${validFields.join(', ')}` });
        }
      }

      const results = performSearch(query, filters, matchMode, searchFields);
      const limitedResults = results.slice(0, parseInt(limit));

      res.status(200).json({
        query,
        total: results.length,
        results: limitedResults,
        filters,
        matchMode,
        searchFields
      });

    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error('Search API error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}

