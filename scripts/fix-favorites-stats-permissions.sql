-- ============================================
-- 修复收藏统计权限问题
-- ============================================
-- 在 Supabase Dashboard 的 SQL Editor 中执行此文件

-- 问题分析：
-- 1. favorites 表有严格的 RLS 策略：USING (auth.uid() = user_id)
-- 2. 即使使用 SECURITY DEFINER 函数，可能仍受 RLS 策略限制
-- 3. 需要确保管理员用户有绕过 RLS 的权限

-- 解决方案1：为管理员创建专门的统计函数
CREATE OR REPLACE FUNCTION get_total_favorites_count_admin()
RETURNS INTEGER AS $$
DECLARE
  count_result INTEGER;
BEGIN
  -- 使用更直接的方式统计，绕过可能的 RLS 问题
  SELECT COUNT(*)::INTEGER
  INTO count_result
  FROM public.favorites;

  RETURN COALESCE(count_result, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 解决方案2：创建收藏统计视图（绕过 RLS）
CREATE OR REPLACE VIEW favorites_stats_view AS
SELECT
  COUNT(*) as total_favorites,
  COUNT(DISTINCT user_id) as unique_users,
  MIN(created_at) as first_favorite,
  MAX(created_at) as last_favorite
FROM public.favorites;

-- 授予视图访问权限
GRANT SELECT ON favorites_stats_view TO authenticated;
GRANT SELECT ON favorites_stats_view TO anon;

-- 解决方案3：创建更详细的统计函数
CREATE OR REPLACE FUNCTION get_favorites_analytics()
RETURNS TABLE(
  total_favorites INTEGER,
  unique_users INTEGER,
  favorites_per_user NUMERIC,
  most_active_users JSONB,
  recent_favorites JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH user_favorite_counts AS (
    SELECT
      user_id,
      COUNT(*) as favorite_count,
      MAX(created_at) as last_favorite
    FROM public.favorites
    GROUP BY user_id
    ORDER BY favorite_count DESC
  ),
  recent_favorites AS (
    SELECT
      f.user_id,
      f.post_url,
      f.created_at,
      p.username
    FROM public.favorites f
    LEFT JOIN public.profiles p ON f.user_id = p.id
    ORDER BY f.created_at DESC
    LIMIT 10
  )
  SELECT
    (SELECT COUNT(*) FROM public.favorites)::INTEGER as total_favorites,
    (SELECT COUNT(DISTINCT user_id) FROM public.favorites)::INTEGER as unique_users,
    (SELECT ROUND(COUNT(*)::NUMERIC / COUNT(DISTINCT user_id), 2) FROM public.favorites)::NUMERIC as favorites_per_user,
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'user_id', user_id,
          'favorite_count', favorite_count,
          'last_favorite', last_favorite
        )
      )
      FROM user_favorite_counts
      WHERE favorite_count > 0
      LIMIT 5
    ) as most_active_users,
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'username', username,
          'post_url', post_url,
          'created_at', created_at
        )
      )
      FROM recent_favorites
    ) as recent_favorites;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 解决方案4：创建按文章分组的收藏统计函数（用于管理后台表格）
CREATE OR REPLACE FUNCTION get_favorites_stats_by_post()
RETURNS TABLE(
  post_url TEXT,
  favorite_count INTEGER,
  first_favorited TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    f.post_url,
    COUNT(*)::INTEGER as favorite_count,
    MIN(f.created_at) as first_favorited
  FROM public.favorites f
  GROUP BY f.post_url
  ORDER BY favorite_count DESC, first_favorited ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 授予函数执行权限
GRANT EXECUTE ON FUNCTION get_total_favorites_count_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION get_favorites_analytics() TO authenticated;
GRANT EXECUTE ON FUNCTION get_favorites_stats_by_post() TO authenticated;

-- 添加函数注释
COMMENT ON FUNCTION get_total_favorites_count_admin() IS
'管理员专用：获取所有用户的总收藏数，完全绕过RLS策略。用于管理员页面统计。';

COMMENT ON FUNCTION get_favorites_analytics() IS
'获取收藏分析数据，包括总收藏数、用户数、人均收藏数、最活跃用户和最近收藏。返回详细的收藏统计信息。';

COMMENT ON FUNCTION get_favorites_stats_by_post() IS
'管理员专用：获取按文章分组的收藏统计数据，完全绕过RLS策略。返回每个文章的收藏数和最早收藏时间，用于管理后台的收藏统计表格。';

COMMENT ON VIEW favorites_stats_view IS
'收藏统计视图，提供基本的收藏统计数据，绕过RLS限制。';

-- ============================================
-- 权限验证和测试查询
-- ============================================

-- 测试1：检查函数是否能正常工作
-- SELECT get_total_favorites_count_admin();

-- 测试2：检查视图是否能正常工作
-- SELECT * FROM favorites_stats_view;

-- 测试3：检查详细分析函数
-- SELECT * FROM get_favorites_analytics();

-- 测试4：检查按文章分组的收藏统计函数（用于管理后台表格）
-- SELECT * FROM get_favorites_stats_by_post();

-- ============================================
-- 故障排除指南
-- ============================================
/*
如果仍然无法获取收藏统计，请检查以下内容：

1. 确保函数创建者有足够的权限：
   SELECT * FROM pg_roles WHERE rolname = current_user;

2. 检查 RLS 策略是否正确：
   SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
   FROM pg_policies
   WHERE tablename = 'favorites';

3. 检查表是否存在且有数据：
   SELECT COUNT(*) FROM public.favorites;

4. 检查函数权限：
   \df+ get_total_favorites_count_admin

5. 如果仍然有问题，可以尝试临时禁用 RLS（仅用于调试）：
   ALTER TABLE public.favorites DISABLE ROW LEVEL SECURITY;
   -- 测试完成后记得重新启用：
   ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
*/