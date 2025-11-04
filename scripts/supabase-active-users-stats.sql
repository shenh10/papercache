-- ============================================
-- 活跃用户分析函数
-- ============================================
-- 在 Supabase Dashboard 的 SQL Editor 中执行此文件
-- 用于创建活跃用户分析相关的函数

-- 函数：获取活跃用户统计（按日期）
CREATE OR REPLACE FUNCTION public.get_active_users_stats(
  p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  date DATE,
  new_users INTEGER,
  active_users INTEGER,
  login_count INTEGER,
  avg_login_per_user NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH daily_logs AS (
    SELECT 
      DATE(ll.login_at) as log_date,
      ll.user_id,
      -- 判断是否为新用户：如果该用户在登录时还没有profile，则认为是新用户
      NOT EXISTS (
        SELECT 1 
        FROM public.profiles p 
        WHERE p.id = ll.user_id 
        AND p.created_at <= ll.login_at
      ) as is_new_user
    FROM public.login_logs ll
    WHERE DATE(ll.login_at) BETWEEN p_start_date AND p_end_date
  )
  SELECT
    log_date as date,
    COUNT(DISTINCT user_id) FILTER (WHERE is_new_user = true)::INTEGER as new_users,
    COUNT(DISTINCT user_id)::INTEGER as active_users,
    COUNT(*)::INTEGER as login_count,
    CASE 
      WHEN COUNT(DISTINCT user_id) > 0 
      THEN ROUND(COUNT(*)::NUMERIC / COUNT(DISTINCT user_id), 2)
      ELSE 0
    END as avg_login_per_user
  FROM daily_logs
  GROUP BY log_date
  ORDER BY log_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 函数：获取今日新注册用户数
CREATE OR REPLACE FUNCTION public.get_new_users_today()
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(DISTINCT ll.user_id)::INTEGER
    FROM public.login_logs ll
    WHERE DATE(ll.login_at) = CURRENT_DATE
      AND NOT EXISTS (
        SELECT 1 
        FROM public.profiles p 
        WHERE p.id = ll.user_id 
        AND p.created_at <= ll.login_at
      )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 函数：获取今日活跃用户数
CREATE OR REPLACE FUNCTION public.get_active_users_today()
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(DISTINCT user_id)::INTEGER
    FROM public.login_logs
    WHERE DATE(login_at) = CURRENT_DATE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 函数：获取指定天数内的活跃用户数
CREATE OR REPLACE FUNCTION public.get_active_users_in_days(p_days INTEGER)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(DISTINCT user_id)::INTEGER
    FROM public.login_logs
    WHERE login_at >= CURRENT_DATE - (p_days || ' days')::INTERVAL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 授予函数执行权限
GRANT EXECUTE ON FUNCTION public.get_active_users_stats(p_start_date DATE, p_end_date DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_new_users_today() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_users_today() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_users_in_days(p_days INTEGER) TO authenticated;

-- 函数：获取活跃用户名单（包含登录次数和最后登录时间）
CREATE OR REPLACE FUNCTION public.get_active_users_list(
  p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date DATE DEFAULT CURRENT_DATE,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0,
  p_order_by TEXT DEFAULT 'login_count' -- 'login_count' 或 'last_login'
)
RETURNS TABLE(
  user_id UUID,
  user_email TEXT,
  username TEXT,
  full_name TEXT,
  login_count INTEGER,
  last_login_at TIMESTAMP WITH TIME ZONE,
  first_login_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  WITH user_login_stats AS (
    SELECT 
      ll.user_id,
      COUNT(*)::INTEGER as login_count,
      MAX(ll.login_at) as last_login_at,
      MIN(ll.login_at) as first_login_at
    FROM public.login_logs ll
    WHERE DATE(ll.login_at) BETWEEN p_start_date AND p_end_date
      AND ll.user_id IS NOT NULL
    GROUP BY ll.user_id
  )
  SELECT
    uls.user_id,
    COALESCE(au.email::TEXT, 'N/A') as user_email,
    p.username,
    p.full_name,
    uls.login_count,
    uls.last_login_at,
    uls.first_login_at
  FROM user_login_stats uls
  LEFT JOIN auth.users au ON uls.user_id = au.id
  LEFT JOIN public.profiles p ON uls.user_id = p.id
  ORDER BY 
    CASE 
      WHEN p_order_by = 'last_login' THEN uls.last_login_at
      ELSE NULL
    END DESC NULLS LAST,
    CASE 
      WHEN p_order_by = 'login_count' THEN uls.login_count
      ELSE NULL
    END DESC NULLS LAST
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 函数：获取活跃用户名单总数
CREATE OR REPLACE FUNCTION public.get_active_users_list_count(
  p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(DISTINCT user_id)::INTEGER
    FROM public.login_logs
    WHERE DATE(login_at) BETWEEN p_start_date AND p_end_date
      AND user_id IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 授予函数执行权限
GRANT EXECUTE ON FUNCTION public.get_active_users_list(DATE, DATE, INTEGER, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_users_list_count(DATE, DATE) TO authenticated;

-- 添加函数注释
COMMENT ON FUNCTION public.get_active_users_list(DATE, DATE, INTEGER, INTEGER, TEXT) IS 
'获取活跃用户名单。返回：用户ID、邮箱、用户名、登录次数、最后登录时间、首次登录时间。支持按登录次数或最后登录时间排序。';

COMMENT ON FUNCTION public.get_active_users_list_count(DATE, DATE) IS 
'获取活跃用户名单总数（用于分页）。';

-- 添加函数注释
COMMENT ON FUNCTION public.get_active_users_stats(DATE, DATE) IS 
'获取活跃用户统计（按日期）。返回：日期、新注册用户数、活跃用户数、登录次数、平均登录次数。';

COMMENT ON FUNCTION public.get_new_users_today() IS 
'获取今日新注册用户数（登录时还没有profile的用户）。';

COMMENT ON FUNCTION public.get_active_users_today() IS 
'获取今日活跃用户数（有登录记录的用户）。';

COMMENT ON FUNCTION public.get_active_users_in_days(INTEGER) IS 
'获取指定天数内的活跃用户数。参数：p_days（天数）。';

