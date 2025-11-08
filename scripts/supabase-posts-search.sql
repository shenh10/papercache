-- ============================================
-- 创建论文搜索表
-- ============================================
-- 在Supabase Dashboard的SQL Editor中执行此文件

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

-- 创建其他索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_posts_search_url ON posts_search(post_url);
CREATE INDEX IF NOT EXISTS idx_posts_search_tag ON posts_search(tag);
CREATE INDEX IF NOT EXISTS idx_posts_search_date ON posts_search(published_date DESC);
CREATE INDEX IF NOT EXISTS idx_posts_search_categories ON posts_search USING GIN(categories);

-- 添加注释
COMMENT ON TABLE posts_search IS '论文搜索表，用于全文搜索功能';
COMMENT ON COLUMN posts_search.post_url IS '论文URL（唯一标识）';
COMMENT ON COLUMN posts_search.title IS '论文标题';
COMMENT ON COLUMN posts_search.excerpt IS '论文摘要';
COMMENT ON COLUMN posts_search.categories IS '论文分类路径数组';
COMMENT ON COLUMN posts_search.tag IS '论文标签（如arXiv）';
COMMENT ON COLUMN posts_search.published_date IS '论文发布日期';
COMMENT ON COLUMN posts_search.search_vector IS '全文搜索向量（自动生成）';

-- ============================================
-- 创建更新 search_vector 的触发器函数
-- ============================================

CREATE OR REPLACE FUNCTION update_posts_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  -- 组合所有文本字段，设置权重
  -- A: 标题（最高权重）
  -- B: 摘要（中等权重）
  -- C: 分类（较低权重）
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.excerpt, '')), 'B') ||
    setweight(to_tsvector('english', array_to_string(COALESCE(NEW.categories, ARRAY[]::TEXT[]), ' ')), 'C');
  
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
DROP TRIGGER IF EXISTS update_posts_search_vector_trigger ON posts_search;
CREATE TRIGGER update_posts_search_vector_trigger
BEFORE INSERT OR UPDATE ON posts_search
FOR EACH ROW
EXECUTE FUNCTION update_posts_search_vector();

-- 为现有数据初始化 search_vector
UPDATE posts_search SET search_vector = NULL;
UPDATE posts_search SET search_vector = NULL WHERE id IS NOT NULL;

-- ============================================
-- 启用 RLS（所有人可读）
-- ============================================

ALTER TABLE posts_search ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can search posts" ON posts_search;
CREATE POLICY "Anyone can search posts"
ON posts_search FOR SELECT
USING (true);

-- ============================================
-- 创建搜索 RPC 函数
-- ============================================

-- 全文搜索函数（使用 PostgreSQL tsvector）
CREATE OR REPLACE FUNCTION search_posts_fulltext(
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
    -- 全文搜索（如果提供了查询）
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
CREATE OR REPLACE FUNCTION search_posts_fuzzy(
  p_query TEXT DEFAULT '',
  p_tag TEXT DEFAULT NULL,
  p_categories TEXT[] DEFAULT NULL,
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
      -- Categories 过滤
      AND (p_categories IS NULL OR ps.categories && p_categories)
      -- 至少有一个字段匹配（如果提供了查询）
      AND (
        p_query IS NULL OR p_query = '' OR
        LOWER(ps.title) LIKE '%' || LOWER(p_query) || '%' OR
        LOWER(ps.excerpt) LIKE '%' || LOWER(p_query) || '%' OR
        array_to_string(ps.categories, ' ') LIKE '%' || LOWER(p_query) || '%'
      )
  )
  SELECT 
    scored_posts.post_url,
    scored_posts.title,
    scored_posts.excerpt,
    scored_posts.categories,
    scored_posts.tag,
    scored_posts.published_date,
    scored_posts.match_score
  FROM scored_posts
  WHERE scored_posts.match_score > 0 OR (p_query IS NULL OR p_query = '')
  ORDER BY scored_posts.match_score DESC, scored_posts.published_date DESC NULLS LAST
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 批量插入/更新论文数据
CREATE OR REPLACE FUNCTION upsert_post_search(
  p_url TEXT,
  p_title TEXT,
  p_excerpt TEXT DEFAULT NULL,
  p_categories TEXT[] DEFAULT NULL,
  p_tag TEXT DEFAULT NULL,
  p_published_date DATE DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO posts_search (post_url, title, excerpt, categories, tag, published_date)
  VALUES (p_url, p_title, p_excerpt, COALESCE(p_categories, ARRAY[]::TEXT[]), p_tag, p_published_date)
  ON CONFLICT (post_url) 
  DO UPDATE SET
    title = EXCLUDED.title,
    excerpt = EXCLUDED.excerpt,
    categories = EXCLUDED.categories,
    tag = EXCLUDED.tag,
    published_date = EXCLUDED.published_date,
    updated_at = NOW()
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 添加函数注释
COMMENT ON FUNCTION search_posts_fulltext IS '全文搜索函数，使用 PostgreSQL tsvector 进行搜索，支持英文全文搜索';
COMMENT ON FUNCTION search_posts_fuzzy IS '模糊搜索函数，使用 LIKE 匹配，支持中文搜索和部分匹配';
COMMENT ON FUNCTION upsert_post_search IS '批量插入或更新论文搜索数据';

