import fs from 'fs';
import path from 'path';
import { parse } from 'yaml';

// 全局变量缓存统计数据
let statsData = null;

// 初始化统计数据
async function initializeStats() {
  if (statsData) {
    return statsData;
  }

  try {
    const collectionPath = path.join(process.cwd(), '_data', 'collection_structure.yml');
    const excerptsPath = path.join(process.cwd(), 'assets', 'data', 'excerpts.json');
    
    if (!fs.existsSync(collectionPath) || !fs.existsSync(excerptsPath)) {
      throw new Error('Data files not found');
    }

    const collectionData = parse(fs.readFileSync(collectionPath, 'utf8'));
    const excerptsData = JSON.parse(fs.readFileSync(excerptsPath, 'utf8'));

    // 提取所有论文数据
    const papers = [];
    const categories = new Set();
    const tags = new Set();
    const years = new Set();

    function extractData(node, currentCategories = []) {
      if (node.posts && Array.isArray(node.posts)) {
        node.posts.forEach(post => {
          const paper = {
            title: post.title,
            url: post.url,
            date: post.date,
            categories: post.categories || currentCategories,
            tag: post.tag || '',
            excerpt: excerptsData[post.url] || ''
          };
          
          papers.push(paper);
          
          // 收集分类
          paper.categories.forEach(cat => categories.add(cat));
          
          // 收集标签
          if (paper.tag) tags.add(paper.tag);
          
          // 收集年份
          if (paper.date) {
            const year = new Date(paper.date).getFullYear();
            years.add(year);
          }
        });
      }
      
      if (typeof node === 'object' && node !== null) {
        Object.keys(node).forEach(key => {
          if (key !== 'posts' && typeof node[key] === 'object') {
            extractData(node[key], [...currentCategories, key]);
          }
        });
      }
    }

    extractData(collectionData);

    // 计算统计数据
    const categoryStats = {};
    categories.forEach(cat => {
      categoryStats[cat] = papers.filter(p => p.categories.includes(cat)).length;
    });

    const tagStats = {};
    tags.forEach(tag => {
      tagStats[tag] = papers.filter(p => p.tag === tag).length;
    });

    const yearStats = {};
    years.forEach(year => {
      yearStats[year] = papers.filter(p => {
        const paperYear = new Date(p.date).getFullYear();
        return paperYear === year;
      }).length;
    });

    // 按月份统计
    const monthStats = {};
    papers.forEach(paper => {
      if (paper.date) {
        const date = new Date(paper.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthStats[monthKey] = (monthStats[monthKey] || 0) + 1;
      }
    });

    // 计算平均摘要长度
    const excerpts = papers.map(p => p.excerpt).filter(e => e);
    const avgExcerptLength = excerpts.length > 0 
      ? Math.round(excerpts.reduce((sum, e) => sum + e.length, 0) / excerpts.length)
      : 0;

    statsData = {
      total: {
        papers: papers.length,
        categories: categories.size,
        tags: tags.size,
        years: years.size
      },
      categories: categoryStats,
      tags: tagStats,
      years: yearStats,
      months: monthStats,
      content: {
        avgExcerptLength,
        totalExcerpts: excerpts.length,
        papersWithExcerpts: excerpts.length
      },
      lastUpdated: new Date().toISOString()
    };

    console.log(`Stats initialized: ${papers.length} papers, ${categories.size} categories, ${tags.size} tags`);
    return statsData;

  } catch (error) {
    console.error('Failed to initialize stats:', error);
    throw error;
  }
}

// 获取分类层次结构统计
function getCategoryHierarchy() {
  if (!statsData) return {};

  const hierarchy = {};
  
  // 从分类统计中构建层次结构
  Object.keys(statsData.categories).forEach(category => {
    const parts = category.split('/');
    let current = hierarchy;
    
    parts.forEach((part, index) => {
      if (!current[part]) {
        current[part] = {
          count: 0,
          children: {}
        };
      }
      
      if (index === parts.length - 1) {
        current[part].count = statsData.categories[category];
      }
      
      current = current[part].children;
    });
  });

  return hierarchy;
}

// 获取趋势数据
function getTrends() {
  if (!statsData) return {};

  const months = Object.keys(statsData.months)
    .sort()
    .slice(-12); // 最近12个月

  const trendData = months.map(month => ({
    month,
    count: statsData.months[month]
  }));

  // 计算增长趋势
  const growth = trendData.length > 1 
    ? ((trendData[trendData.length - 1].count - trendData[0].count) / trendData[0].count * 100)
    : 0;

  return {
    monthly: trendData,
    growth: Math.round(growth * 100) / 100,
    period: '12 months'
  };
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
    // 初始化统计数据
    await initializeStats();

    const { method } = req;

    if (method === 'GET') {
      const { type = 'all' } = req.query;

      let response = {};

      switch (type) {
        case 'overview':
          response = {
            total: statsData.total,
            content: statsData.content,
            lastUpdated: statsData.lastUpdated
          };
          break;

        case 'categories':
          response = {
            categories: statsData.categories,
            hierarchy: getCategoryHierarchy()
          };
          break;

        case 'tags':
          response = {
            tags: statsData.tags
          };
          break;

        case 'trends':
          response = {
            trends: getTrends()
          };
          break;

        case 'years':
          response = {
            years: statsData.years
          };
          break;

        default:
          response = {
            ...statsData,
            hierarchy: getCategoryHierarchy(),
            trends: getTrends()
          };
      }

      res.status(200).json(response);

    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error('Stats API error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}

