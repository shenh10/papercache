# 使用 Supabase 实现全文搜索方案

## 可行性分析

### ✅ 优势

1. **统一数据源**
   - 收藏、点赞、搜索都使用 Supabase
   - 减少依赖，简化架构

2. **PostgreSQL 全文搜索能力**
   - 内置 `tsvector` 和 `tsquery` 支持
   - 支持中文搜索（需要配置中文分词）
   - 支持权重排序、模糊匹配
   - 性能优秀，可扩展性强

3. **实时同步**
   - 论文数据更新后立即可搜索
   - 不需要重新构建索引

4. **成本**
   - 免费额度：50,000 MAU，500MB 数据库
   - 对于中小型论文库足够使用

5. **简化部署**
   - 不需要 Vercel Serverless Functions
   - 不需要维护 Lunr.js 索引
   - 减少构建时间

### ⚠️ 挑战

1. **数据同步**
   - 需要将论文数据同步到 Supabase
   - 已有 `sync_supabase_with_posts.py` 可以扩展

2. **中文搜索**
   - PostgreSQL 默认不支持中文分词
   - 需要配置 `zhparser` 或使用简单的字符匹配

3. **索引维护**
   - 需要定期更新全文搜索索引
   - 可以自动化处理

## 实现方案

### 1. 数据库表结构

```sql
-- 创建论文搜索表
CREATE TABLE IF NOT EXISTS posts_search (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  excerpt TEXT,
  categories TEXT[],
  tag TEXT,
  published_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 全文搜索字段（由触发器自动维护）
  search_vector tsvector
);

-- 创建全文搜索索引
CREATE INDEX IF NOT EXISTS idx_posts_search_vector 
ON posts_search USING GIN(search_vector);

-- 创建其他索引
CREATE INDEX IF NOT EXISTS idx_posts_search_url ON posts_search(post_url);
CREATE INDEX IF NOT EXISTS idx_posts_search_tag ON posts_search(tag);
CREATE INDEX IF NOT EXISTS idx_posts_search_date ON posts_search(published_date DESC);

-- 创建更新 search_vector 的触发器函数
CREATE OR REPLACE FUNCTION update_posts_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  -- 组合所有文本字段
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.excerpt, '')), 'B') ||
    setweight(to_tsvector('english', array_to_string(COALESCE(NEW.categories, ARRAY[]::TEXT[]), ' ')), 'C');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
CREATE TRIGGER update_posts_search_vector_trigger
BEFORE INSERT OR UPDATE ON posts_search
FOR EACH ROW
EXECUTE FUNCTION update_posts_search_vector();

-- 启用 RLS（所有人可读）
ALTER TABLE posts_search ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can search posts" ON posts_search;
CREATE POLICY "Anyone can search posts"
ON posts_search FOR SELECT
USING (true);
```

### 2. 搜索 RPC 函数

```sql
-- 全文搜索函数
CREATE OR REPLACE FUNCTION search_posts(
  p_query TEXT DEFAULT '',
  p_tag TEXT DEFAULT NULL,
  p_categories TEXT[] DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  post_url TEXT,
  title TEXT,
  excerpt TEXT,
  categories TEXT[],
  tag TEXT,
  published_date DATE,
  relevance REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ps.post_url,
    ps.title,
    ps.excerpt,
    ps.categories,
    ps.tag,
    ps.published_date,
    ts_rank(ps.search_vector, plainto_tsquery('english', p_query))::REAL AS relevance
  FROM posts_search ps
  WHERE 
    -- 全文搜索
    (p_query IS NULL OR p_query = '' OR ps.search_vector @@ plainto_tsquery('english', p_query))
    -- Tag 过滤
    AND (p_tag IS NULL OR ps.tag = p_tag)
    -- Categories 过滤
    AND (p_categories IS NULL OR ps.categories && p_categories)
  ORDER BY 
    -- 按相关性排序（如果有查询）
    CASE WHEN p_query IS NOT NULL AND p_query != '' 
      THEN ts_rank(ps.search_vector, plainto_tsquery('english', p_query)) 
      ELSE 1.0 
    END DESC,
    -- 按发布日期排序
    ps.published_date DESC NULLS LAST
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 模糊搜索函数（支持中文和部分匹配）
CREATE OR REPLACE FUNCTION fuzzy_search_posts(
  p_query TEXT DEFAULT '',
  p_tag TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE(
  post_url TEXT,
  title TEXT,
  excerpt TEXT,
  categories TEXT[],
  tag TEXT,
  published_date DATE,
  match_score INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH scored_posts AS (
    SELECT 
      ps.post_url,
      ps.title,
      ps.excerpt,
      ps.categories,
      ps.tag,
      ps.published_date,
      -- 计算匹配分数
      (
        -- 标题完全匹配：100分
        CASE WHEN LOWER(ps.title) = LOWER(p_query) THEN 100
        -- 标题包含：50分
        WHEN LOWER(ps.title) LIKE '%' || LOWER(p_query) || '%' THEN 50
        -- 摘要包含：20分
        WHEN LOWER(ps.excerpt) LIKE '%' || LOWER(p_query) || '%' THEN 20
        -- 分类包含：10分
        WHEN array_to_string(ps.categories, ' ') LIKE '%' || LOWER(p_query) || '%' THEN 10
        ELSE 0
        END
      ) AS match_score
    FROM posts_search ps
    WHERE 
      -- Tag 过滤
      (p_tag IS NULL OR ps.tag = p_tag)
      -- 至少有一个字段匹配
      AND (
        LOWER(ps.title) LIKE '%' || LOWER(p_query) || '%' OR
        LOWER(ps.excerpt) LIKE '%' || LOWER(p_query) || '%' OR
        array_to_string(ps.categories, ' ') LIKE '%' || LOWER(p_query) || '%'
      )
  )
  SELECT * FROM scored_posts
  WHERE match_score > 0
  ORDER BY match_score DESC, published_date DESC NULLS LAST
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 3. 前端调用示例

```javascript
// 使用 Supabase 搜索
async function searchWithSupabase(query, filters = {}) {
  const { data, error } = await supabase.rpc('fuzzy_search_posts', {
    p_query: query,
    p_tag: filters.tag || null,
    p_limit: 50
  });
  
  if (error) {
    console.error('搜索失败:', error);
    return [];
  }
  
  return data;
}
```

### 4. 数据同步脚本扩展

扩展 `sync_supabase_with_posts.py`，添加同步到 `posts_search` 表的逻辑：

```python
def sync_posts_to_search_table():
    """同步论文数据到搜索表"""
    posts = get_all_posts_metadata()
    
    for post in posts:
        call_supabase_rpc('upsert_post_search', {
            'p_url': post['url'],
            'p_title': post['title'],
            'p_excerpt': post.get('excerpt', ''),
            'p_categories': post.get('categories', []),
            'p_tag': post.get('tag', ''),
            'p_published_date': post.get('date')
        })
```

### 5. 中文搜索优化

如果需要更好的中文支持，可以考虑：

1. **使用 pg_trgm 扩展**（PostgreSQL 内置）
   ```sql
   CREATE EXTENSION IF NOT EXISTS pg_trgm;
   
   CREATE INDEX idx_posts_search_title_trgm 
   ON posts_search USING GIN(title gin_trgm_ops);
   ```

2. **使用相似度搜索**
   ```sql
   CREATE OR REPLACE FUNCTION similarity_search_posts(p_query TEXT)
   RETURNS TABLE(...) AS $$
   SELECT *, similarity(title, p_query) AS sim
   FROM posts_search
   WHERE similarity(title, p_query) > 0.3
   ORDER BY sim DESC;
   $$ LANGUAGE plpgsql;
   ```

## 迁移步骤

1. **创建表结构**
   - 在 Supabase Dashboard 执行上述 SQL

2. **数据同步**
   - 扩展 `sync_supabase_with_posts.py`
   - 运行同步脚本

3. **前端改造**
   - 修改 `search-first.js`，使用 Supabase RPC 替代 API 调用
   - 保留前端降级搜索作为备用

4. **测试**
   - 对比搜索结果质量
   - 测试性能
   - 测试中文搜索

5. **逐步迁移**
   - 可以先并行运行（Vercel API + Supabase）
   - 根据效果决定是否完全切换

## 性能对比

| 特性 | Vercel + Lunr | Supabase |
|------|---------------|----------|
| 搜索速度 | 快（内存索引） | 快（数据库索引） |
| 中文支持 | 一般 | 需要配置 |
| 实时更新 | 需要重建索引 | 自动更新 |
| 扩展性 | 有限 | 优秀 |
| 成本 | 免费（有限制） | 免费（有限制） |
| 维护成本 | 中等 | 低 |

## 建议

1. **短期**：保持现有 Vercel API，同时测试 Supabase 搜索
2. **中期**：如果 Supabase 搜索效果好，逐步迁移
3. **长期**：统一使用 Supabase 作为数据源和搜索后端

## 注意事项

1. 中文搜索需要额外配置（pg_trgm 或中文分词插件）
2. 需要定期同步论文数据（可以自动化）
3. 免费版有查询限制，需要监控使用量
4. 搜索函数需要使用 `SECURITY DEFINER` 绕过 RLS

