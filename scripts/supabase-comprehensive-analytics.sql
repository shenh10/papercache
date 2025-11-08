-- ============================================
-- 整合活跃度分析函数
-- 整合 login_logs 和 user_activity_logs 两个数据源
-- ============================================
-- 在 Supabase Dashboard 的 SQL Editor 中执行此文件

-- 函数：获取综合活跃用户统计（整合两个数据源）
-- 修复：确保只统计真实的已注册用户，并正确去重
CREATE OR REPLACE FUNCTION public.get_comprehensive_active_users_stats(
  p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  date DATE,
  total_active_users INTEGER,
  login_users INTEGER,
  session_active_users INTEGER,
  page_view_users INTEGER,
  search_users INTEGER,
  favorite_users INTEGER,
  total_activities INTEGER,
  login_count INTEGER,
  page_view_count INTEGER,
  search_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH daily_activities AS (
    -- 合并两个数据源的活动（只统计真实存在的用户）
    SELECT
      DATE(activity_date) as activity_date,
      user_id,
      activity_type,
      activity_count
    FROM (
      -- login_logs 数据
      SELECT
        ll.login_at as activity_date,
        ll.user_id,
        'login' as activity_type,
        1 as activity_count
      FROM public.login_logs ll
      INNER JOIN public.profiles p ON ll.user_id = p.id  -- 通过profiles表验证用户存在
      WHERE DATE(ll.login_at) BETWEEN p_start_date AND p_end_date
        AND ll.user_id IS NOT NULL

      UNION ALL

      -- user_activity_logs 数据（排除登录相关，避免重复）
      SELECT
        ual.created_at as activity_date,
        ual.user_id,
        ual.activity_type,
        1 as activity_count
      FROM public.user_activity_logs ual
      INNER JOIN public.profiles p ON ual.user_id = p.id  -- 通过profiles表验证用户存在
      WHERE DATE(ual.created_at) BETWEEN p_start_date AND p_end_date
        AND ual.user_id IS NOT NULL
        AND ual.activity_type IN ('page_view', 'search', 'click', 'favorite')
    ) all_activities
  ),
  user_daily_stats AS (
    -- 计算每个用户每天的活动统计
    SELECT
      activity_date,
      user_id,
      COUNT(*) FILTER (WHERE activity_type = 'login') as login_count,
      COUNT(*) FILTER (WHERE activity_type = 'page_view') as page_view_count,
      COUNT(*) FILTER (WHERE activity_type = 'search') as search_count,
      COUNT(*) FILTER (WHERE activity_type = 'favorite') as favorite_count,
      COUNT(*) FILTER (WHERE activity_type IN ('page_view', 'search', 'click', 'favorite')) as session_activity_count,
      COUNT(*) as total_activity_count
    FROM daily_activities
    GROUP BY activity_date, user_id
  )
  SELECT
    activity_date as date,
    COUNT(*)::INTEGER as total_active_users,
    COUNT(*) FILTER (WHERE login_count > 0)::INTEGER as login_users,
    COUNT(*) FILTER (WHERE session_activity_count > 0)::INTEGER as session_active_users,
    COUNT(*) FILTER (WHERE page_view_count > 0)::INTEGER as page_view_users,
    COUNT(*) FILTER (WHERE search_count > 0)::INTEGER as search_users,
    COUNT(*) FILTER (WHERE favorite_count > 0)::INTEGER as favorite_users,
    SUM(total_activity_count)::INTEGER as total_activities,
    SUM(login_count)::INTEGER as login_count,
    SUM(page_view_count)::INTEGER as page_view_count,
    SUM(search_count)::INTEGER as search_count
  FROM user_daily_stats
  GROUP BY activity_date
  ORDER BY activity_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 函数：获取今日综合活跃用户统计
-- 修复：确保只统计真实的已注册用户（通过profiles表验证用户存在），并正确去重
-- 注意：使用profiles表而不是auth.users表，避免权限问题
CREATE OR REPLACE FUNCTION public.get_comprehensive_active_users_today()
RETURNS TABLE(
  total_active_users INTEGER,
  login_users INTEGER,
  session_active_users INTEGER,
  page_view_users INTEGER,
  search_users INTEGER,
  favorite_users INTEGER,
  total_activities INTEGER,
  avg_activities_per_user NUMERIC
) AS $$
DECLARE
  current_date DATE := CURRENT_DATE;
BEGIN
  RETURN QUERY
  WITH unique_active_users AS (
    -- 获取今日所有活跃的唯一用户ID（确保用户真实存在，通过profiles表验证）
    SELECT DISTINCT user_id
    FROM (
      -- login_logs 中的用户
      SELECT DISTINCT ll.user_id
      FROM public.login_logs ll
      INNER JOIN public.profiles p ON ll.user_id = p.id  -- 通过profiles表验证用户存在
      WHERE DATE(ll.login_at) = current_date
        AND ll.user_id IS NOT NULL

      UNION

      -- user_activity_logs 中的用户
      SELECT DISTINCT ual.user_id
      FROM public.user_activity_logs ual
      INNER JOIN public.profiles p ON ual.user_id = p.id  -- 通过profiles表验证用户存在
      WHERE DATE(ual.created_at) = current_date
        AND ual.user_id IS NOT NULL
        AND ual.activity_type IN ('page_view', 'search', 'click', 'favorite')
    ) all_users
  ),
  user_activity_flags AS (
    -- 为每个用户标记各种活动类型
    SELECT
      uau.user_id,
      EXISTS (
        SELECT 1 FROM public.login_logs ll
        WHERE ll.user_id = uau.user_id
          AND DATE(ll.login_at) = current_date
      ) as has_login,
      EXISTS (
        SELECT 1 FROM public.user_activity_logs ual
        WHERE ual.user_id = uau.user_id
          AND DATE(ual.created_at) = current_date
          AND ual.activity_type IN ('page_view', 'search', 'click', 'favorite')
      ) as has_session_activity,
      EXISTS (
        SELECT 1 FROM public.user_activity_logs ual
        WHERE ual.user_id = uau.user_id
          AND DATE(ual.created_at) = current_date
          AND ual.activity_type = 'page_view'
      ) as has_page_view,
      EXISTS (
        SELECT 1 FROM public.user_activity_logs ual
        WHERE ual.user_id = uau.user_id
          AND DATE(ual.created_at) = current_date
          AND ual.activity_type = 'search'
      ) as has_search,
      EXISTS (
        SELECT 1 FROM public.user_activity_logs ual
        WHERE ual.user_id = uau.user_id
          AND DATE(ual.created_at) = current_date
          AND ual.activity_type = 'favorite'
      ) as has_favorite,
      (
        SELECT COUNT(*)
        FROM (
          SELECT 1 FROM public.login_logs ll
          WHERE ll.user_id = uau.user_id AND DATE(ll.login_at) = current_date
          UNION ALL
          SELECT 1 FROM public.user_activity_logs ual
          WHERE ual.user_id = uau.user_id
            AND DATE(ual.created_at) = current_date
            AND ual.activity_type IN ('page_view', 'search', 'click', 'favorite')
        ) activities
      ) as total_activities
    FROM unique_active_users uau
  )
  SELECT
    COUNT(*)::INTEGER as total_active_users,
    COUNT(*) FILTER (WHERE uaf.has_login)::INTEGER as login_users,
    COUNT(*) FILTER (WHERE uaf.has_session_activity)::INTEGER as session_active_users,
    COUNT(*) FILTER (WHERE uaf.has_page_view)::INTEGER as page_view_users,
    COUNT(*) FILTER (WHERE uaf.has_search)::INTEGER as search_users,
    COUNT(*) FILTER (WHERE uaf.has_favorite)::INTEGER as favorite_users,
    SUM(uaf.total_activities)::INTEGER as total_activities,
    CASE
      WHEN COUNT(*) > 0
      THEN ROUND(SUM(uaf.total_activities)::NUMERIC / COUNT(*), 2)
      ELSE 0
    END as avg_activities_per_user
  FROM user_activity_flags uaf;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 函数：获取指定天数内的综合活跃用户数
-- 修复：确保只统计真实的已注册用户，并正确去重（通过profiles表验证）
CREATE OR REPLACE FUNCTION public.get_comprehensive_active_users_in_days(p_days INTEGER)
RETURNS INTEGER AS $$
DECLARE
  count_result INTEGER;
BEGIN
  SELECT COUNT(DISTINCT user_id)::INTEGER
  INTO count_result
  FROM (
    SELECT DISTINCT ll.user_id
    FROM public.login_logs ll
    INNER JOIN public.profiles p ON ll.user_id = p.id  -- 通过profiles表验证用户存在
    WHERE ll.login_at >= CURRENT_DATE - (p_days || ' days')::INTERVAL
      AND ll.user_id IS NOT NULL

    UNION

    SELECT DISTINCT ual.user_id
    FROM public.user_activity_logs ual
    INNER JOIN public.profiles p ON ual.user_id = p.id  -- 通过profiles表验证用户存在
    WHERE ual.created_at >= CURRENT_DATE - (p_days || ' days')::INTERVAL
      AND ual.user_id IS NOT NULL
      AND ual.activity_type IN ('page_view', 'search', 'click', 'favorite')
  ) comprehensive_activities;

  RETURN COALESCE(count_result, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 函数：获取用户活跃度等级分布
CREATE OR REPLACE FUNCTION public.get_user_activity_levels(
  p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  activity_level TEXT,
  user_count INTEGER,
  percentage NUMERIC,
  description TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH user_activity_counts AS (
    SELECT
      u.user_id,
      COUNT(DISTINCT u.activity_date) as active_days,
      SUM(u.activity_count) as total_activities
    FROM (
      -- 合并两个数据源（只统计真实用户）
      SELECT
        ll.user_id,
        DATE(ll.login_at) as activity_date,
        1 as activity_count
      FROM public.login_logs ll
      INNER JOIN public.profiles p ON ll.user_id = p.id  -- 通过profiles表验证用户存在
      WHERE DATE(ll.login_at) BETWEEN p_start_date AND p_end_date
        AND ll.user_id IS NOT NULL

      UNION ALL

      SELECT
        ual.user_id,
        DATE(ual.created_at) as activity_date,
        1 as activity_count
      FROM public.user_activity_logs ual
      INNER JOIN public.profiles p ON ual.user_id = p.id  -- 通过profiles表验证用户存在
      WHERE DATE(ual.created_at) BETWEEN p_start_date AND p_end_date
        AND ual.user_id IS NOT NULL
        AND ual.activity_type IN ('page_view', 'search', 'click', 'favorite')
    ) u
    GROUP BY u.user_id
  ),
  total_users AS (
    SELECT COUNT(*) FROM user_activity_counts
  )
  SELECT
    CASE
      WHEN total_activities >= 50 THEN '超级活跃用户'
      WHEN total_activities >= 20 THEN '活跃用户'
      WHEN total_activities >= 5 THEN '一般活跃用户'
      WHEN total_activities >= 1 THEN '低活跃用户'
      ELSE '非活跃用户'
    END as activity_level,
    COUNT(*)::INTEGER as user_count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM total_users), 2) as percentage,
    CASE
      WHEN total_activities >= 50 THEN '月活动50+次'
      WHEN total_activities >= 20 THEN '月活动20-49次'
      WHEN total_activities >= 5 THEN '月活动5-19次'
      WHEN total_activities >= 1 THEN '月活动1-4次'
      ELSE '月无活动'
    END as description
  FROM user_activity_counts
  GROUP BY
    CASE
      WHEN total_activities >= 50 THEN '超级活跃用户'
      WHEN total_activities >= 20 THEN '活跃用户'
      WHEN total_activities >= 5 THEN '一般活跃用户'
      WHEN total_activities >= 1 THEN '低活跃用户'
      ELSE '非活跃用户'
    END,
    CASE
      WHEN total_activities >= 50 THEN '月活动50+次'
      WHEN total_activities >= 20 THEN '月活动20-49次'
      WHEN total_activities >= 5 THEN '月活动5-19次'
      WHEN total_activities >= 1 THEN '月活动1-4次'
      ELSE '月无活动'
    END
  ORDER BY
    CASE
      WHEN total_activities >= 50 THEN 1
      WHEN total_activities >= 20 THEN 2
      WHEN total_activities >= 5 THEN 3
      WHEN total_activities >= 1 THEN 4
      ELSE 5
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 函数：获取最活跃的用户列表
CREATE OR REPLACE FUNCTION public.get_most_active_users(
  p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date DATE DEFAULT CURRENT_DATE,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE(
  user_id UUID,
  user_email TEXT,
  username TEXT,
  total_activities INTEGER,
  login_count INTEGER,
  page_view_count INTEGER,
  search_count INTEGER,
  favorite_count INTEGER,
  activity_level TEXT,
  last_activity_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  WITH user_comprehensive_stats AS (
    SELECT
      u.user_id,
      COUNT(*) FILTER (WHERE u.activity_type = 'login') as login_count,
      COUNT(*) FILTER (WHERE u.activity_type = 'page_view') as page_view_count,
      COUNT(*) FILTER (WHERE u.activity_type = 'search') as search_count,
      COUNT(*) FILTER (WHERE u.activity_type = 'favorite') as favorite_count,
      COUNT(*) as total_activities,
      MAX(u.activity_date) as last_activity_at
    FROM (
      -- login_logs 数据（只统计真实用户）
      SELECT
        ll.user_id,
        'login' as activity_type,
        ll.login_at as activity_date
      FROM public.login_logs ll
      INNER JOIN public.profiles p ON ll.user_id = p.id  -- 通过profiles表验证用户存在
      WHERE DATE(ll.login_at) BETWEEN p_start_date AND p_end_date
        AND ll.user_id IS NOT NULL

      UNION ALL

      -- user_activity_logs 数据（只统计真实用户）
      SELECT
        ual.user_id,
        ual.activity_type,
        ual.created_at as activity_date
      FROM public.user_activity_logs ual
      INNER JOIN public.profiles p ON ual.user_id = p.id  -- 通过profiles表验证用户存在
      WHERE DATE(ual.created_at) BETWEEN p_start_date AND p_end_date
        AND ual.user_id IS NOT NULL
        AND ual.activity_type IN ('page_view', 'search', 'click', 'favorite')
    ) u
    GROUP BY u.user_id
  )
  SELECT
    ucs.user_id,
    COALESCE(au.email::TEXT, 'N/A') as user_email,
    p.username,
    ucs.total_activities,
    ucs.login_count,
    ucs.page_view_count,
    ucs.search_count,
    ucs.favorite_count,
    CASE
      WHEN ucs.total_activities >= 50 THEN '超级活跃用户'
      WHEN ucs.total_activities >= 20 THEN '活跃用户'
      WHEN ucs.total_activities >= 5 THEN '一般活跃用户'
      ELSE '低活跃用户'
    END as activity_level,
    ucs.last_activity_at
  FROM user_comprehensive_stats ucs
  LEFT JOIN auth.users au ON ucs.user_id = au.id
  LEFT JOIN public.profiles p ON ucs.user_id = p.id
  ORDER BY ucs.total_activities DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 授予函数执行权限
GRANT EXECUTE ON FUNCTION public.get_comprehensive_active_users_stats(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_comprehensive_active_users_today() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_comprehensive_active_users_in_days(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_activity_levels(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_most_active_users(DATE, DATE, INTEGER) TO authenticated;

-- 添加函数注释
COMMENT ON FUNCTION public.get_comprehensive_active_users_stats(DATE, DATE) IS
'获取综合活跃用户统计（整合login_logs和user_activity_logs）。返回：总活跃用户数、登录用户数、会话活跃用户数、页面浏览用户数、搜索用户数、收藏用户数、总活动数、登录次数、页面浏览次数、搜索次数。';

COMMENT ON FUNCTION public.get_comprehensive_active_users_today() IS
'获取今日综合活跃用户统计。提供详细的用户活跃度分析，包括平均活动次数。';

COMMENT ON FUNCTION public.get_comprehensive_active_users_in_days(INTEGER) IS
'获取指定天数内的综合活跃用户数。整合登录和活动数据，提供准确的活跃度统计。';

COMMENT ON FUNCTION public.get_user_activity_levels(DATE, DATE) IS
'获取用户活跃度等级分布。将用户按活跃程度分为：超级活跃用户、活跃用户、一般活跃用户、低活跃用户等。';

COMMENT ON FUNCTION public.get_most_active_users(DATE, DATE, INTEGER) IS
'获取最活跃的用户列表。返回用户ID、邮箱、用户名、各种活动统计、活跃度等级和最后活动时间。';

-- 示例查询
/*
-- 查看今日综合活跃用户统计
SELECT * FROM public.get_comprehensive_active_users_today();

-- 查看最近30天的活跃用户趋势
SELECT * FROM public.get_comprehensive_active_users_stats(
  CURRENT_DATE - INTERVAL '30 days',
  CURRENT_DATE
);

-- 查看用户活跃度等级分布
SELECT * FROM public.get_user_activity_levels();

-- 查看最活跃的20个用户
SELECT * FROM public.get_most_active_users() LIMIT 20;
*/