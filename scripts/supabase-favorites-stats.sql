-- 收藏量统计优化函数
-- 在Supabase Dashboard的SQL Editor中执行

-- ============================================
-- 批量获取多个文章的收藏数（聚合函数版本）
-- ============================================
-- 这个函数在数据库层面直接统计，避免返回所有行数据
-- 返回格式：JSON对象，键为post_url，值为收藏数

CREATE OR REPLACE FUNCTION batch_get_favorite_counts(p_urls TEXT[])
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_object_agg(post_url, favorite_count)
  INTO result
  FROM (
    SELECT 
      post_url,
      COUNT(*)::INTEGER as favorite_count
    FROM favorites
    WHERE post_url = ANY(p_urls)
    GROUP BY post_url
  ) counts;
  
  -- 如果result为NULL（没有匹配的数据），返回空对象
  RETURN COALESCE(result, '{}'::JSON);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 给函数添加注释
COMMENT ON FUNCTION batch_get_favorite_counts(TEXT[]) IS 
'批量获取多个文章的收藏数，返回JSON对象。参数：URL数组。返回：{"/url1": 5, "/url2": 3, ...}';

-- ============================================
-- 获取单个文章的收藏数（可选，用于兼容）
-- ============================================

CREATE OR REPLACE FUNCTION get_favorite_count(p_url TEXT)
RETURNS INTEGER AS $$
DECLARE
  count_result INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER
  INTO count_result
  FROM favorites
  WHERE post_url = p_url;
  
  RETURN COALESCE(count_result, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 给函数添加注释
COMMENT ON FUNCTION get_favorite_count(TEXT) IS 
'获取单个文章的收藏数。参数：文章URL。返回：收藏数（整数）';

-- ============================================
-- 权限说明
-- ============================================
-- 这些函数使用 SECURITY DEFINER，意味着它们以函数创建者的权限运行
-- 即使普通用户没有直接查询favorites表的权限，也可以通过这些函数获取收藏数
-- 这样可以在保持RLS策略的同时，允许匿名用户查看收藏统计

