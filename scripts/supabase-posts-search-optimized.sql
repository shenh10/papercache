-- Supabase 搜索性能优化
-- 使用 pg_trgm 扩展和 GIN 索引来加速模糊搜索
--
-- 标点归一化（hyphen-insensitive 等）：
--   "DeepSeek-V4" 与 "DeepSeek V4" 双向匹配；
--   "FlashAttention-2" 与 "flashattention 2" 等价；
--   仅替换 ASCII 标点（[[:punct:]]），不影响中文字符与字母数字。

-- 1. 启用 pg_trgm 扩展（用于相似度搜索和索引）
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. 添加归一化生成列：把标题/摘要里的标点统一替换为空格，全部转小写
--    使用 STORED 生成列（PG12+），写入时计算一次，查询直接读，可以建索引
ALTER TABLE posts_search
  ADD COLUMN IF NOT EXISTS title_normalized TEXT
    GENERATED ALWAYS AS (
      lower(regexp_replace(coalesce(title, ''), '[[:punct:]]+', ' ', 'g'))
    ) STORED;

ALTER TABLE posts_search
  ADD COLUMN IF NOT EXISTS excerpt_normalized TEXT
    GENERATED ALWAYS AS (
      lower(regexp_replace(coalesce(excerpt, ''), '[[:punct:]]+', ' ', 'g'))
    ) STORED;

-- 3. 创建 GIN trigram 索引——分别给原列和归一化列建，保证旧函数（fuzzy / fulltext）和新函数都能用上索引
CREATE INDEX IF NOT EXISTS idx_posts_search_title_gin_trgm
  ON posts_search USING GIN(title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_posts_search_excerpt_gin_trgm
  ON posts_search USING GIN(excerpt gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_posts_search_title_norm_gin_trgm
  ON posts_search USING GIN(title_normalized gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_posts_search_excerpt_norm_gin_trgm
  ON posts_search USING GIN(excerpt_normalized gin_trgm_ops);

-- 4. 优化后的模糊搜索函数（标点不敏感 + 索引友好）
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
DECLARE
  v_q TEXT;          -- 归一化后的查询
  v_cat_query TEXT;  -- 用于分类匹配（已归一化）
BEGIN
  -- 空查询：直接按日期返回
  IF p_query IS NULL OR btrim(p_query) = '' THEN
    RETURN QUERY
    SELECT
      ps.post_url, ps.title, ps.excerpt, ps.categories, ps.tag, ps.published_date,
      0 AS match_score
    FROM posts_search ps
    WHERE
      (p_tag IS NULL OR ps.tag = p_tag)
      AND (p_categories IS NULL OR ps.categories && p_categories)
    ORDER BY ps.published_date DESC NULLS LAST
    LIMIT p_limit;
    RETURN;
  END IF;

  -- 把查询里的所有标点替换成空格、小写化、压缩多余空白
  v_q := btrim(regexp_replace(lower(p_query), '[[:punct:]]+', ' ', 'g'));
  v_q := regexp_replace(v_q, '\s+', ' ', 'g');

  -- 归一化后为空（用户只输入了标点）：按日期返回
  IF v_q = '' THEN
    RETURN QUERY
    SELECT ps.post_url, ps.title, ps.excerpt, ps.categories, ps.tag, ps.published_date, 0
    FROM posts_search ps
    WHERE (p_tag IS NULL OR ps.tag = p_tag)
      AND (p_categories IS NULL OR ps.categories && p_categories)
    ORDER BY ps.published_date DESC NULLS LAST
    LIMIT p_limit;
    RETURN;
  END IF;

  RETURN QUERY
  WITH scored_posts AS (
    SELECT
      ps.post_url,
      ps.title,
      ps.excerpt,
      ps.categories,
      ps.tag,
      ps.published_date,
      ps.title_normalized AS t_norm,
      ps.excerpt_normalized AS e_norm,
      lower(regexp_replace(
        array_to_string(coalesce(ps.categories, ARRAY[]::TEXT[]), ' '),
        '[[:punct:]]+', ' ', 'g'
      )) AS c_norm
    FROM posts_search ps
    WHERE
      (p_tag IS NULL OR ps.tag = p_tag)
      AND (p_categories IS NULL OR ps.categories && p_categories)
  ),
  ranked AS (
    SELECT
      sp.*,
      (
        CASE
          WHEN sp.t_norm = v_q THEN 100
          WHEN sp.t_norm LIKE v_q || '%' THEN 80
          WHEN similarity(sp.t_norm, v_q) > 0.3
            THEN CAST(similarity(sp.t_norm, v_q) * 60 AS INTEGER)
          WHEN sp.t_norm LIKE '%' || v_q || '%' THEN 50
          WHEN sp.e_norm LIKE '%' || v_q || '%' THEN 20
          WHEN sp.c_norm LIKE '%' || v_q || '%' THEN 10
          ELSE 0
        END
      ) AS match_score
    FROM scored_posts sp
    WHERE
      sp.t_norm LIKE v_q || '%'
      OR similarity(sp.t_norm, v_q) > 0.2
      OR sp.t_norm LIKE '%' || v_q || '%'
      OR sp.e_norm LIKE '%' || v_q || '%'
      OR sp.c_norm LIKE '%' || v_q || '%'
  )
  SELECT
    ranked.post_url,
    ranked.title,
    ranked.excerpt,
    ranked.categories,
    ranked.tag,
    ranked.published_date,
    ranked.match_score
  FROM ranked
  WHERE ranked.match_score > 0
  ORDER BY ranked.match_score DESC, ranked.published_date DESC NULLS LAST
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. 函数注释
COMMENT ON FUNCTION search_posts_fuzzy_optimized IS
  '优化后的模糊搜索函数：标点不敏感（- _ . , ; : 等等于空格），使用 pg_trgm + GIN 索引加速';

-- 6. 分析表以更新统计信息（帮助查询优化器选择最佳执行计划）
ANALYZE posts_search;
