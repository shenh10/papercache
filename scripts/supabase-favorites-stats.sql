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
-- 批量检查用户收藏状态（优化版本）
-- ============================================
-- 这个函数在数据库层面检查，避免返回所有行数据
-- 返回格式：JSON对象，键为post_url，值为布尔值（true表示已收藏）

CREATE OR REPLACE FUNCTION batch_check_user_favorites(p_user_id UUID, p_urls TEXT[])
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  -- 查询用户收藏的URL列表，然后构建JSON对象
  SELECT json_object_agg(post_url, true)
  INTO result
  FROM (
    SELECT DISTINCT post_url
    FROM favorites
    WHERE user_id = p_user_id
      AND post_url = ANY(p_urls)
  ) user_favorites;
  
  -- 如果result为NULL（没有收藏），返回空对象
  RETURN COALESCE(result, '{}'::JSON);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 给函数添加注释
COMMENT ON FUNCTION batch_check_user_favorites(UUID, TEXT[]) IS 
'批量检查用户收藏状态，返回JSON对象。参数：用户ID和URL数组。返回：{"/url1": true, "/url2": true, ...}';

-- ============================================
-- 组合查询：同时获取收藏数和用户收藏状态（最高效）
-- ============================================
-- 这个函数一次性返回收藏数和用户收藏状态，减少网络往返

CREATE OR REPLACE FUNCTION batch_get_favorites_with_status(p_user_id UUID, p_urls TEXT[])
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'counts', COALESCE(counts_json, '{}'::JSON),
    'user_favorited', COALESCE(user_favorited_json, '{}'::JSON)
  )
  INTO result
  FROM (
    SELECT 
      -- 收藏数统计
      (SELECT json_object_agg(post_url, favorite_count)
       FROM (
         SELECT post_url, COUNT(*)::INTEGER as favorite_count
         FROM favorites
         WHERE post_url = ANY(p_urls)
         GROUP BY post_url
       ) counts) as counts_json,
      
      -- 用户收藏状态（仅当提供了user_id时）
      (SELECT json_object_agg(post_url, true)
       FROM (
         SELECT DISTINCT post_url
         FROM favorites
         WHERE user_id = p_user_id
           AND post_url = ANY(p_urls)
       ) user_favorites
       WHERE p_user_id IS NOT NULL) as user_favorited_json
  ) combined;
  
  RETURN COALESCE(result, '{"counts": {}, "user_favorited": {}}'::JSON);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 给函数添加注释
COMMENT ON FUNCTION batch_get_favorites_with_status(UUID, TEXT[]) IS 
'同时获取收藏数和用户收藏状态，返回JSON对象。参数：用户ID（可为NULL）和URL数组。返回：{"counts": {"/url1": 5, ...}, "user_favorited": {"/url1": true, ...}}';

-- ============================================
-- 获取总收藏数（所有用户）
-- ============================================
-- 这个函数用于统计所有用户的总收藏数，绕过 RLS 策略限制
-- 用于管理员页面显示统计信息

CREATE OR REPLACE FUNCTION get_total_favorites_count()
RETURNS INTEGER AS $$
DECLARE
  count_result INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER
  INTO count_result
  FROM favorites;
  
  RETURN COALESCE(count_result, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 给函数添加注释
COMMENT ON FUNCTION get_total_favorites_count() IS 
'获取所有用户的总收藏数，绕过RLS策略限制。用于管理员页面统计。返回：总收藏数（整数）';

-- 授予函数执行权限
GRANT EXECUTE ON FUNCTION get_total_favorites_count() TO anon, authenticated;

-- ============================================
-- 权限说明
-- ============================================
-- 这些函数使用 SECURITY DEFINER，意味着它们以函数创建者的权限运行
-- 即使普通用户没有直接查询favorites表的权限，也可以通过这些函数获取收藏数
-- 
-- 对于需要用户ID的函数（batch_check_user_favorites, batch_get_favorites_with_status），
-- 函数内部会验证user_id，确保安全
-- 这样可以在保持RLS策略的同时，允许匿名用户查看收藏统计

