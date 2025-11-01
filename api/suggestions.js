import fs from 'fs';
import path from 'path';
import { parse } from 'yaml';

// 全局变量缓存数据
let papersData = null;
let categoriesData = null;

// 初始化数据
async function initializeData() {
  if (papersData && categoriesData) {
    return { papersData, categoriesData };
  }

  try {
    const collectionPath = path.join(process.cwd(), '_data', 'collection_structure.yml');
    const excerptsPath = path.join(process.cwd(), 'assets', 'data', 'excerpts.json');
    
    if (!fs.existsSync(collectionPath) || !fs.existsSync(excerptsPath)) {
      throw new Error('Data files not found');
    }

    const collectionData = parse(fs.readFileSync(collectionPath, 'utf8'));
    const excerptsData = JSON.parse(fs.readFileSync(excerptsPath, 'utf8'));

    // 提取论文数据
    papersData = [];
    categoriesData = new Set();

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
            categoriesData.add(key);
            extractPapers(node[key], [...categories, key]);
          }
        });
      }
    }

    extractPapers(collectionData);

    console.log(`Suggestions data initialized with ${papersData.length} papers and ${categoriesData.size} categories`);
    return { papersData, categoriesData };

  } catch (error) {
    console.error('Failed to initialize suggestions data:', error);
    throw error;
  }
}

// 获取搜索建议
function getSuggestions(query, limit = 10) {
  if (!papersData || !categoriesData) {
    throw new Error('Data not initialized');
  }

  const suggestions = [];
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(word => word.length > 1);

  // 1. 标题匹配（精确匹配优先）
  const titleMatches = papersData
    .filter(paper => {
      const titleLower = paper.title.toLowerCase();
      return queryWords.some(word => titleLower.includes(word));
    })
    .sort((a, b) => {
      const aExact = a.title.toLowerCase().startsWith(queryLower);
      const bExact = b.title.toLowerCase().startsWith(queryLower);
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      return a.title.localeCompare(b.title);
    })
    .slice(0, 5)
    .map(paper => ({
      type: 'paper',
      text: paper.title,
      url: paper.url,
      categories: paper.categories,
      date: paper.date
    }));

  suggestions.push(...titleMatches);

  // 2. 分类匹配
  const categoryMatches = Array.from(categoriesData)
    .filter(cat => cat.toLowerCase().includes(queryLower))
    .slice(0, 3)
    .map(cat => ({
      type: 'category',
      text: cat,
      url: `/papers/${cat.toLowerCase()}`,
      count: papersData.filter(p => p.categories.includes(cat)).length
    }));

  suggestions.push(...categoryMatches);

  // 3. 标签匹配
  const tagMatches = [...new Set(papersData.map(p => p.tag).filter(tag => tag && tag.toLowerCase().includes(queryLower)))]
    .slice(0, 2)
    .map(tag => ({
      type: 'tag',
      text: tag,
      url: `/papers/tag/${tag.toLowerCase()}`,
      count: papersData.filter(p => p.tag === tag).length
    }));

  suggestions.push(...tagMatches);

  // 4. 摘要关键词匹配
  const excerptMatches = papersData
    .filter(paper => {
      const excerptLower = paper.excerpt.toLowerCase();
      return queryWords.some(word => excerptLower.includes(word));
    })
    .slice(0, 3)
    .map(paper => ({
      type: 'excerpt',
      text: paper.title,
      url: paper.url,
      excerpt: paper.excerpt.substring(0, 100) + '...',
      categories: paper.categories
    }));

  suggestions.push(...excerptMatches);

  return suggestions.slice(0, limit);
}

// 获取热门搜索词
function getPopularSearches(limit = 10) {
  if (!papersData) return [];

  // 基于论文标题和分类生成热门搜索词
  const popularTerms = [];
  
  // 从分类中提取
  categoriesData.forEach(cat => {
    popularTerms.push({
      text: cat,
      type: 'category',
      count: papersData.filter(p => p.categories.includes(cat)).length
    });
  });

  // 从标签中提取
  const tagCounts = {};
  papersData.forEach(paper => {
    if (paper.tag) {
      tagCounts[paper.tag] = (tagCounts[paper.tag] || 0) + 1;
    }
  });

  Object.entries(tagCounts).forEach(([tag, count]) => {
    popularTerms.push({
      text: tag,
      type: 'tag',
      count
    });
  });

  return popularTerms
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// API 处理函数
export default async function handler(req, res) {
  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // 初始化数据
    await initializeData();

    const { method } = req;

    if (method === 'GET') {
      const { q, limit = 10, type = 'all' } = req.query;
      
      if (!q) {
        // 返回热门搜索词
        const popular = getPopularSearches(parseInt(limit));
        return res.status(200).json({
          type: 'popular',
          suggestions: popular
        });
      }

      const suggestions = getSuggestions(q, parseInt(limit));
      
      res.status(200).json({
        query: q,
        suggestions: suggestions,
        total: suggestions.length
      });

    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error('Suggestions API error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}

