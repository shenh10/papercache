-- Supabase 搜索性能优化
-- 使用 pg_trgm 扩展和 GIN 索引来加速模糊搜索

-- 1. 启用 pg_trgm 扩展（用于相似度搜索和索引）
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. 创建 GIN 索引用于快速文本搜索（如果还没有）
-- 这些索引会大大加速 LIKE 查询
CREATE INDEX IF NOT EXISTS idx_posts_search_title_gin_trgm 
ON posts_search USING GIN(title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_posts_search_excerpt_gin_trgm 
ON posts_search USING GIN(excerpt gin_trgm_ops);

-- 3. 优化后的模糊搜索函数（使用索引友好的查询）
CREATE OR REPLACE FUNCTION search_posts_fuzzy_optimized(
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
  -- 如果查询为空，只返回按日期排序的结果
  IF p_query IS NULL OR p_query = '' THEN
    RETURN QUERY
    SELECT 
      ps.post_url,
      ps.title,
      ps.excerpt,
      ps.categories,
      ps.tag,
      ps.published_date,
      0 AS match_score
    FROM posts_search ps
    WHERE 
      (p_tag IS NULL OR ps.tag = p_tag)
      AND (p_categories IS NULL OR ps.categories && p_categories)
    ORDER BY ps.published_date DESC NULLS LAST
    LIMIT p_limit;
    RETURN;
  END IF;

  -- 使用相似度搜索（可以利用 GIN 索引）
  RETURN QUERY
  WITH scored_posts AS (
    SELECT 
      ps.post_url,
      ps.title,
      ps.excerpt,
      ps.categories,
      ps.tag,
      ps.published_date,
      -- 使用相似度分数 + 位置分数
      (
        -- 标题完全匹配：100分
        CASE WHEN LOWER(ps.title) = LOWER(p_query) THEN 100
        -- 标题开头匹配：80分（可以利用索引）
        WHEN LOWER(ps.title) LIKE LOWER(p_query) || '%' THEN 80
        -- 标题包含（使用相似度）：60分
        WHEN similarity(LOWER(ps.title), LOWER(p_query)) > 0.3 THEN 
          CAST(similarity(LOWER(ps.title), LOWER(p_query)) * 60 AS INTEGER)
        -- 标题包含（LIKE）：50分
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
      -- Tag 过滤（使用索引）
      (p_tag IS NULL OR ps.tag = p_tag)
      -- Categories 过滤（使用索引）
      AND (p_categories IS NULL OR ps.categories && p_categories)
      -- 使用相似度或 LIKE 匹配（可以利用 GIN 索引）
      AND (
        -- 标题开头匹配（最快，可以利用索引）
        LOWER(ps.title) LIKE LOWER(p_query) || '%' OR
        -- 标题相似度匹配（可以使用 GIN 索引）
        similarity(LOWER(ps.title), LOWER(p_query)) > 0.2 OR
        -- 标题包含（可以使用 GIN 索引）
        LOWER(ps.title) LIKE '%' || LOWER(p_query) || '%' OR
        -- 摘要包含
        LOWER(ps.excerpt) LIKE '%' || LOWER(p_query) || '%' OR
        -- 分类包含
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
  WHERE scored_posts.match_score > 0
  ORDER BY scored_posts.match_score DESC, scored_posts.published_date DESC NULLS LAST
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. 添加函数注释
COMMENT ON FUNCTION search_posts_fuzzy_optimized IS '优化后的模糊搜索函数，使用 pg_trgm 和 GIN 索引加速搜索';

-- 5. 分析表以更新统计信息（帮助查询优化器选择最佳执行计划）
ANALYZE posts_search;


