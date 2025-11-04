-- ============================================
-- 综合活跃用户名单函数（整合 login_logs 和 user_activity_logs）
-- 在数据库侧进行聚合查询，不返回所有条目
-- ============================================
-- 在 Supabase Dashboard 的 SQL Editor 中执行此文件

-- 函数：获取综合活跃用户名单（整合两个数据源）
-- 在数据库侧聚合统计，返回每个用户的综合活动数据
CREATE OR REPLACE FUNCTION public.get_comprehensive_active_users_list(
  p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date DATE DEFAULT CURRENT_DATE,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0,
  p_order_by TEXT DEFAULT 'total_activities' -- 'total_activities', 'login_count', 'last_activity_at'
)
RETURNS TABLE(
  user_id UUID,
  user_email TEXT,
  username TEXT,
  full_name TEXT,
  total_activities INTEGER,
  login_count INTEGER,
  page_view_count INTEGER,
  search_count INTEGER,
  favorite_count INTEGER,
  click_count INTEGER,
  active_days INTEGER,
  first_activity_at TIMESTAMP WITH TIME ZONE,
  last_activity_at TIMESTAMP WITH TIME ZONE,
  activity_level TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH user_activity_stats AS (
    -- 在数据库侧聚合所有用户活动（只统计真实用户）
    SELECT
      u.user_id,
      COUNT(*) FILTER (WHERE u.activity_type = 'login')::INTEGER as login_count,
      COUNT(*) FILTER (WHERE u.activity_type = 'page_view')::INTEGER as page_view_count,
      COUNT(*) FILTER (WHERE u.activity_type = 'search')::INTEGER as search_count,
      COUNT(*) FILTER (WHERE u.activity_type = 'favorite')::INTEGER as favorite_count,
      COUNT(*) FILTER (WHERE u.activity_type = 'click')::INTEGER as click_count,
      COUNT(*)::INTEGER as total_activities,
      COUNT(DISTINCT DATE(u.activity_date))::INTEGER as active_days,
      MIN(u.activity_date)::TIMESTAMP WITH TIME ZONE as first_activity_at,
      MAX(u.activity_date)::TIMESTAMP WITH TIME ZONE as last_activity_at
    FROM (
      -- login_logs 数据（只统计真实用户）
      SELECT
        ll.user_id::UUID,
        ll.login_at::TIMESTAMP WITH TIME ZONE as activity_date,
        'login'::TEXT as activity_type
      FROM public.login_logs ll
      INNER JOIN public.profiles p ON ll.user_id = p.id  -- 通过profiles表验证用户存在
      WHERE DATE(ll.login_at) BETWEEN p_start_date AND p_end_date
        AND ll.user_id IS NOT NULL

      UNION ALL

      -- user_activity_logs 数据（只统计真实用户）
      SELECT
        ual.user_id::UUID,
        ual.created_at::TIMESTAMP WITH TIME ZONE as activity_date,
        ual.activity_type::TEXT
      FROM public.user_activity_logs ual
      INNER JOIN public.profiles p ON ual.user_id = p.id  -- 通过profiles表验证用户存在
      WHERE DATE(ual.created_at) BETWEEN p_start_date AND p_end_date
        AND ual.user_id IS NOT NULL
        AND ual.activity_type IN ('page_view', 'search', 'click', 'favorite')
    ) u
    GROUP BY u.user_id
  )
  SELECT
    uas.user_id::UUID,
    COALESCE(au.email::TEXT, 'N/A')::TEXT as user_email,
    COALESCE(p.username::TEXT, '')::TEXT as username,
    COALESCE(p.full_name::TEXT, '')::TEXT as full_name,
    uas.total_activities::INTEGER,
    uas.login_count::INTEGER,
    uas.page_view_count::INTEGER,
    uas.search_count::INTEGER,
    uas.favorite_count::INTEGER,
    uas.click_count::INTEGER,
    uas.active_days::INTEGER,
    uas.first_activity_at::TIMESTAMP WITH TIME ZONE,
    uas.last_activity_at::TIMESTAMP WITH TIME ZONE,
    (CASE
      WHEN uas.total_activities >= 50 THEN '超级活跃用户'
      WHEN uas.total_activities >= 20 THEN '活跃用户'
      WHEN uas.total_activities >= 5 THEN '一般活跃用户'
      WHEN uas.total_activities >= 1 THEN '低活跃用户'
      ELSE '非活跃用户'
    END)::TEXT as activity_level
  FROM user_activity_stats uas
  LEFT JOIN auth.users au ON uas.user_id = au.id
  LEFT JOIN public.profiles p ON uas.user_id = p.id
  ORDER BY 
    CASE 
      WHEN p_order_by = 'last_activity_at' THEN uas.last_activity_at
      ELSE NULL
    END DESC NULLS LAST,
    CASE 
      WHEN p_order_by = 'login_count' THEN uas.login_count
      ELSE NULL
    END DESC NULLS LAST,
    CASE 
      WHEN p_order_by = 'total_activities' THEN uas.total_activities
      ELSE NULL
    END DESC NULLS LAST
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 函数：获取综合活跃用户名单总数（用于分页，只统计已登录用户）
-- 注意：活跃用户名单只显示已登录用户，不包括匿名用户
CREATE OR REPLACE FUNCTION public.get_comprehensive_active_users_list_count(
  p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(DISTINCT user_id)::INTEGER
    FROM (
      -- login_logs 中的用户（已登录用户）
      SELECT DISTINCT ll.user_id
      FROM public.login_logs ll
      INNER JOIN public.profiles p ON ll.user_id = p.id  -- 通过profiles表验证用户存在
      WHERE DATE(ll.login_at) BETWEEN p_start_date AND p_end_date
        AND ll.user_id IS NOT NULL

      UNION

      -- user_activity_logs 中的用户（只统计已登录用户，不包括匿名用户）
      SELECT DISTINCT ual.user_id
      FROM public.user_activity_logs ual
      INNER JOIN public.profiles p ON ual.user_id = p.id  -- 通过profiles表验证用户存在
      WHERE DATE(ual.created_at) BETWEEN p_start_date AND p_end_date
        AND ual.user_id IS NOT NULL
        AND ual.activity_type IN ('page_view', 'search', 'click', 'favorite')
    ) comprehensive_users
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 函数：获取综合活跃用户统计（按日期聚合，整合两个数据源）
-- 替换原有的 get_active_users_stats，使用综合统计
CREATE OR REPLACE FUNCTION public.get_comprehensive_active_users_stats_by_date(
  p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  date DATE,
  new_users INTEGER,
  active_users INTEGER,
  login_users INTEGER,
  session_active_users INTEGER,
  total_activities INTEGER,
  login_count INTEGER,
  page_view_count INTEGER,
  search_count INTEGER,
  avg_activities_per_user NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH daily_activities AS (
    -- 合并两个数据源的活动（包含已登录用户和匿名用户）
    SELECT
      DATE(activity_date) as activity_date,
      user_identifier,
      activity_type,
      is_new_user,
      is_authenticated
    FROM (
      -- login_logs 数据（已登录用户）
      SELECT
        ll.login_at as activity_date,
        ll.user_id::TEXT as user_identifier,
        'login' as activity_type,
        -- 判断是否为新用户：如果该用户在登录时还没有profile，则认为是新用户
        NOT EXISTS (
          SELECT 1 
          FROM public.profiles p 
          WHERE p.id = ll.user_id 
          AND p.created_at <= ll.login_at
        ) as is_new_user,
        true as is_authenticated
      FROM public.login_logs ll
      INNER JOIN public.profiles p ON ll.user_id = p.id  -- 通过profiles表验证用户存在
      WHERE DATE(ll.login_at) BETWEEN p_start_date AND p_end_date
        AND ll.user_id IS NOT NULL

      UNION ALL

      -- user_activity_logs 数据（包含已登录用户和匿名用户）
      SELECT
        ual.created_at as activity_date,
        -- 已登录用户使用 user_id，匿名用户使用 session_id
        COALESCE(ual.user_id::TEXT, 'anon_' || ual.session_id) as user_identifier,
        ual.activity_type,
        false as is_new_user,  -- 非登录活动不统计新用户
        CASE WHEN ual.user_id IS NOT NULL THEN true ELSE false END as is_authenticated
      FROM public.user_activity_logs ual
      WHERE DATE(ual.created_at) BETWEEN p_start_date AND p_end_date
        AND (
          -- 已登录用户：验证在 profiles 中存在
          (ual.user_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.profiles p WHERE p.id = ual.user_id
          ))
          OR
          -- 匿名用户：使用 session_id
          (ual.user_id IS NULL AND ual.session_id IS NOT NULL)
        )
        AND ual.activity_type IN ('page_view', 'search', 'click', 'favorite')
    ) all_activities
  ),
  daily_stats AS (
    -- 按日期聚合统计（包含已登录用户和匿名用户）
    SELECT
      activity_date,
      -- 新用户：只统计已登录的新用户（匿名用户不算新用户）
      COUNT(DISTINCT user_identifier) FILTER (WHERE is_new_user = true AND is_authenticated = true)::INTEGER as new_users,
      -- 总活跃用户：包含已登录用户和匿名用户
      COUNT(DISTINCT user_identifier)::INTEGER as active_users,
      -- 登录用户：只统计已登录的用户
      COUNT(DISTINCT user_identifier) FILTER (WHERE activity_type = 'login' AND is_authenticated = true)::INTEGER as login_users,
      -- 会话活跃用户：包含已登录用户和匿名用户（有页面浏览、搜索、点击、收藏活动的）
      COUNT(DISTINCT user_identifier) FILTER (WHERE activity_type IN ('page_view', 'search', 'click', 'favorite'))::INTEGER as session_active_users,
      COUNT(*)::INTEGER as total_activities,
      COUNT(*) FILTER (WHERE activity_type = 'login')::INTEGER as login_count,
      COUNT(*) FILTER (WHERE activity_type = 'page_view')::INTEGER as page_view_count,
      COUNT(*) FILTER (WHERE activity_type = 'search')::INTEGER as search_count
    FROM daily_activities
    GROUP BY activity_date
  )
  SELECT
    ds.activity_date as date,
    ds.new_users,
    ds.active_users,
    ds.login_users,
    ds.session_active_users,
    ds.total_activities,
    ds.login_count,
    ds.page_view_count,
    ds.search_count,
    CASE 
      WHEN ds.active_users > 0 
      THEN ROUND(ds.total_activities::NUMERIC / ds.active_users, 2)
      ELSE 0
    END as avg_activities_per_user
  FROM daily_stats ds
  ORDER BY ds.activity_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 函数：获取今日综合活跃用户数（整合两个数据源，包含匿名用户）
CREATE OR REPLACE FUNCTION public.get_comprehensive_active_users_today_count()
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(DISTINCT user_identifier)::INTEGER
    FROM (
      -- login_logs 中的用户（已登录用户）
      SELECT DISTINCT ll.user_id::TEXT as user_identifier
      FROM public.login_logs ll
      INNER JOIN public.profiles p ON ll.user_id = p.id  -- 通过profiles表验证用户存在
      WHERE DATE(ll.login_at) = CURRENT_DATE
        AND ll.user_id IS NOT NULL

      UNION

      -- user_activity_logs 中的用户（包含已登录用户和匿名用户）
      SELECT DISTINCT COALESCE(ual.user_id::TEXT, 'anon_' || ual.session_id) as user_identifier
      FROM public.user_activity_logs ual
      WHERE DATE(ual.created_at) = CURRENT_DATE
        AND (
          -- 已登录用户：验证在 profiles 中存在
          (ual.user_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.profiles p WHERE p.id = ual.user_id
          ))
          OR
          -- 匿名用户：使用 session_id
          (ual.user_id IS NULL AND ual.session_id IS NOT NULL)
        )
        AND ual.activity_type IN ('page_view', 'search', 'click', 'favorite')
    ) today_users
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 函数：获取指定天数内的综合活跃用户数（整合两个数据源，包含匿名用户）
CREATE OR REPLACE FUNCTION public.get_comprehensive_active_users_in_days_count(p_days INTEGER)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(DISTINCT user_identifier)::INTEGER
    FROM (
      -- login_logs 中的用户（已登录用户）
      SELECT DISTINCT ll.user_id::TEXT as user_identifier
      FROM public.login_logs ll
      INNER JOIN public.profiles p ON ll.user_id = p.id  -- 通过profiles表验证用户存在
      WHERE ll.login_at >= CURRENT_DATE - (p_days || ' days')::INTERVAL
        AND ll.user_id IS NOT NULL

      UNION

      -- user_activity_logs 中的用户（包含已登录用户和匿名用户）
      SELECT DISTINCT COALESCE(ual.user_id::TEXT, 'anon_' || ual.session_id) as user_identifier
      FROM public.user_activity_logs ual
      WHERE ual.created_at >= CURRENT_DATE - (p_days || ' days')::INTERVAL
        AND (
          -- 已登录用户：验证在 profiles 中存在
          (ual.user_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.profiles p WHERE p.id = ual.user_id
          ))
          OR
          -- 匿名用户：使用 session_id
          (ual.user_id IS NULL AND ual.session_id IS NOT NULL)
        )
        AND ual.activity_type IN ('page_view', 'search', 'click', 'favorite')
    ) comprehensive_users
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 授予函数执行权限
GRANT EXECUTE ON FUNCTION public.get_comprehensive_active_users_list(DATE, DATE, INTEGER, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_comprehensive_active_users_list_count(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_comprehensive_active_users_stats_by_date(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_comprehensive_active_users_today_count() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_comprehensive_active_users_in_days_count(INTEGER) TO authenticated;

-- 添加函数注释
COMMENT ON FUNCTION public.get_comprehensive_active_users_list(DATE, DATE, INTEGER, INTEGER, TEXT) IS 
'获取综合活跃用户名单（整合login_logs和user_activity_logs）。在数据库侧聚合统计，返回每个用户的综合活动数据。支持按总活动数、登录次数或最后活动时间排序。';

COMMENT ON FUNCTION public.get_comprehensive_active_users_list_count(DATE, DATE) IS 
'获取综合活跃用户名单总数（用于分页）。只统计已登录用户，不包括匿名用户（因为匿名用户没有用户信息可显示）。';

COMMENT ON FUNCTION public.get_comprehensive_active_users_stats_by_date(DATE, DATE) IS 
'获取综合活跃用户统计（按日期聚合，整合两个数据源，包含匿名用户）。返回每日的活跃用户数（包含匿名用户）、新用户数（仅已登录）、登录用户数、会话活跃用户数（包含匿名用户）、活动次数等。';

COMMENT ON FUNCTION public.get_comprehensive_active_users_today_count() IS 
'获取今日综合活跃用户数（整合两个数据源，包含匿名用户）。统计今日有登录记录或有其他活动记录的唯一用户数（已登录用户通过user_id标识，匿名用户通过session_id标识）。';

COMMENT ON FUNCTION public.get_comprehensive_active_users_in_days_count(INTEGER) IS 
'获取指定天数内的综合活跃用户数（整合两个数据源，包含匿名用户）。参数：p_days（天数）。已登录用户通过user_id标识，匿名用户通过session_id标识。';

