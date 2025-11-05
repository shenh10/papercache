-- ============================================
-- 诊断DAU统计异常问题
-- 用于检查为什么DAU显示10个，但实际只有2个用户
-- ============================================

-- 1. 检查今日活跃用户的详细情况
-- 查看所有今日有活动的用户ID（包括真实用户和可能的无效用户）
SELECT 
  'login_logs' as source,
  ll.user_id,
  CASE 
    WHEN au.id IS NOT NULL THEN '真实用户'
    ELSE '无效用户（用户已删除）'
  END as user_status,
  COUNT(*) as record_count,
  MIN(ll.login_at) as first_login,
  MAX(ll.login_at) as last_login
FROM public.login_logs ll
LEFT JOIN auth.users au ON ll.user_id = au.id
WHERE DATE(ll.login_at) = CURRENT_DATE
  AND ll.user_id IS NOT NULL
GROUP BY ll.user_id, au.id
ORDER BY user_status, ll.user_id;

SELECT 
  'user_activity_logs' as source,
  ual.user_id,
  CASE 
    WHEN au.id IS NOT NULL THEN '真实用户'
    ELSE '无效用户（用户已删除）'
  END as user_status,
  COUNT(*) as record_count,
  COUNT(DISTINCT ual.activity_type) as activity_types,
  MIN(ual.created_at) as first_activity,
  MAX(ual.created_at) as last_activity
FROM public.user_activity_logs ual
LEFT JOIN auth.users au ON ual.user_id = au.id
WHERE DATE(ual.created_at) = CURRENT_DATE
  AND ual.user_id IS NOT NULL
GROUP BY ual.user_id, au.id
ORDER BY user_status, ual.user_id;

-- 2. 检查合并后的今日活跃用户（模拟修复后的函数逻辑）
-- 注意：这里只统计真实存在的用户（与修复后的函数逻辑一致）
-- 使用 profiles 表验证用户存在，避免权限问题
WITH unique_active_users AS (
  -- 获取今日所有活跃的唯一用户ID（确保用户真实存在）
  SELECT DISTINCT user_id
  FROM (
    -- login_logs 中的用户
    SELECT DISTINCT ll.user_id
    FROM public.login_logs ll
    INNER JOIN public.profiles p ON ll.user_id = p.id  -- 通过profiles表验证用户存在
    WHERE DATE(ll.login_at) = CURRENT_DATE
      AND ll.user_id IS NOT NULL

    UNION

    -- user_activity_logs 中的用户
    SELECT DISTINCT ual.user_id
    FROM public.user_activity_logs ual
    INNER JOIN public.profiles p ON ual.user_id = p.id  -- 通过profiles表验证用户存在
    WHERE DATE(ual.created_at) = CURRENT_DATE
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
        AND DATE(ll.login_at) = CURRENT_DATE
    ) as has_login,
    EXISTS (
      SELECT 1 FROM public.user_activity_logs ual
      WHERE ual.user_id = uau.user_id
        AND DATE(ual.created_at) = CURRENT_DATE
        AND ual.activity_type IN ('page_view', 'search', 'click', 'favorite')
    ) as has_session_activity,
    EXISTS (
      SELECT 1 FROM public.user_activity_logs ual
      WHERE ual.user_id = uau.user_id
        AND DATE(ual.created_at) = CURRENT_DATE
        AND ual.activity_type = 'page_view'
    ) as has_page_view,
    EXISTS (
      SELECT 1 FROM public.user_activity_logs ual
      WHERE ual.user_id = uau.user_id
        AND DATE(ual.created_at) = CURRENT_DATE
        AND ual.activity_type = 'search'
    ) as has_search,
    EXISTS (
      SELECT 1 FROM public.user_activity_logs ual
      WHERE ual.user_id = uau.user_id
        AND DATE(ual.created_at) = CURRENT_DATE
        AND ual.activity_type = 'favorite'
    ) as has_favorite,
    (
      SELECT COUNT(*)
      FROM (
        SELECT 1 FROM public.login_logs ll
        WHERE ll.user_id = uau.user_id AND DATE(ll.login_at) = CURRENT_DATE
        UNION ALL
        SELECT 1 FROM public.user_activity_logs ual
        WHERE ual.user_id = uau.user_id
          AND DATE(ual.created_at) = CURRENT_DATE
          AND ual.activity_type IN ('page_view', 'search', 'click', 'favorite')
      ) activities
    ) as total_activities
  FROM unique_active_users uau
)
SELECT 
  uaf.user_id,
  au.email,
  uaf.has_login,
  uaf.has_session_activity,
  uaf.has_page_view,
  uaf.has_search,
  uaf.has_favorite,
  uaf.total_activities
FROM user_activity_flags uaf
LEFT JOIN auth.users au ON uaf.user_id = au.id
ORDER BY uaf.user_id;

-- 3. 检查函数返回的结果（修复后的函数）
SELECT * FROM public.get_comprehensive_active_users_today();

-- 3a. 对比：统计所有用户（包括无效用户）的数量
SELECT 
  '修复前（可能包含无效用户）' as calculation_method,
  COUNT(DISTINCT user_id)::INTEGER as total_active_users
FROM (
  SELECT DISTINCT ll.user_id
  FROM public.login_logs ll
  WHERE DATE(ll.login_at) = CURRENT_DATE
    AND ll.user_id IS NOT NULL
  UNION
  SELECT DISTINCT ual.user_id
  FROM public.user_activity_logs ual
  WHERE DATE(ual.created_at) = CURRENT_DATE
    AND ual.user_id IS NOT NULL
    AND ual.activity_type IN ('page_view', 'search', 'click', 'favorite')
) all_users;

-- 3b. 对比：只统计真实用户的数量（修复后的逻辑，使用profiles表）
SELECT 
  '修复后（只统计真实用户，通过profiles验证）' as calculation_method,
  COUNT(DISTINCT user_id)::INTEGER as total_active_users
FROM (
  SELECT DISTINCT ll.user_id
  FROM public.login_logs ll
  INNER JOIN public.profiles p ON ll.user_id = p.id  -- 通过profiles表验证用户存在
  WHERE DATE(ll.login_at) = CURRENT_DATE
    AND ll.user_id IS NOT NULL
  UNION
  SELECT DISTINCT ual.user_id
  FROM public.user_activity_logs ual
  INNER JOIN public.profiles p ON ual.user_id = p.id  -- 通过profiles表验证用户存在
  WHERE DATE(ual.created_at) = CURRENT_DATE
    AND ual.user_id IS NOT NULL
    AND ual.activity_type IN ('page_view', 'search', 'click', 'favorite')
) real_users;

-- 3c. 统计今日活跃的唯一用户数（简单去重，不验证用户是否存在）
SELECT 
  '今日唯一用户数（简单去重）' as calculation_method,
  COUNT(DISTINCT user_id)::INTEGER as total_active_users
FROM (
  SELECT user_id FROM public.login_logs
  WHERE DATE(login_at) = CURRENT_DATE
    AND user_id IS NOT NULL
  UNION
  SELECT user_id FROM public.user_activity_logs
  WHERE DATE(created_at) = CURRENT_DATE
    AND user_id IS NOT NULL
    AND activity_type IN ('page_view', 'search', 'click', 'favorite')
) all_activities;

-- 4. 检查是否有匿名用户（session_id）被错误统计
SELECT 
  COUNT(DISTINCT session_id) as anonymous_sessions,
  COUNT(*) as total_anonymous_records
FROM public.user_activity_logs
WHERE DATE(created_at) = CURRENT_DATE
  AND user_id IS NULL
  AND session_id IS NOT NULL;

-- 5. 检查是否有无效的用户ID（用户已删除但记录仍存在）
-- 5a. 检查 login_logs 中的无效用户ID
SELECT 
  'login_logs中的无效用户' as issue_type,
  ll.user_id,
  COUNT(*) as record_count,
  MIN(ll.login_at) as earliest_record,
  MAX(ll.login_at) as latest_record
FROM public.login_logs ll
LEFT JOIN auth.users au ON ll.user_id = au.id
WHERE au.id IS NULL
  AND ll.user_id IS NOT NULL
GROUP BY ll.user_id
ORDER BY record_count DESC
LIMIT 10;

-- 5b. 检查 user_activity_logs 中的无效用户ID
SELECT 
  'user_activity_logs中的无效用户' as issue_type,
  ual.user_id,
  COUNT(*) as record_count,
  MIN(ual.created_at) as earliest_record,
  MAX(ual.created_at) as latest_record
FROM public.user_activity_logs ual
LEFT JOIN auth.users au ON ual.user_id = au.id
WHERE au.id IS NULL
  AND ual.user_id IS NOT NULL
GROUP BY ual.user_id
ORDER BY record_count DESC
LIMIT 10;

-- 5c. 检查所有真实用户的活动统计
SELECT 
  p.id as user_id,
  au.email,
  p.username,
  p.created_at as profile_created_at,
  COUNT(DISTINCT DATE(ll.login_at)) as login_days,
  COUNT(ll.id) as total_logins,
  MAX(ll.login_at) as last_login
FROM public.profiles p
INNER JOIN auth.users au ON p.id = au.id
LEFT JOIN public.login_logs ll ON p.id = ll.user_id
GROUP BY p.id, au.email, p.username, p.created_at
ORDER BY p.created_at DESC;

-- 6. 检查今日所有活动的详细记录（前20条）
SELECT 
  'login_logs' as source,
  user_id,
  login_at as activity_time,
  'login' as activity_type,
  NULL::TEXT as page_path
FROM public.login_logs
WHERE DATE(login_at) = CURRENT_DATE
  AND user_id IS NOT NULL

UNION ALL

SELECT 
  'user_activity_logs' as source,
  user_id,
  created_at as activity_time,
  activity_type,
  page_path
FROM public.user_activity_logs
WHERE DATE(created_at) = CURRENT_DATE
  AND user_id IS NOT NULL
  AND activity_type IN ('page_view', 'search', 'click', 'favorite')

ORDER BY activity_time DESC
LIMIT 20;

-- 7. 统计今日活动的详细情况
-- 7a. 按用户统计今日活动数量
SELECT 
  user_id,
  COUNT(*) as total_activities,
  COUNT(*) FILTER (WHERE activity_type = 'login') as login_count,
  COUNT(*) FILTER (WHERE activity_type = 'page_view') as page_view_count,
  COUNT(*) FILTER (WHERE activity_type = 'search') as search_count,
  COUNT(*) FILTER (WHERE activity_type = 'click') as click_count,
  COUNT(*) FILTER (WHERE activity_type = 'favorite') as favorite_count,
  MIN(activity_time) as first_activity,
  MAX(activity_time) as last_activity
FROM (
  SELECT user_id, login_at as activity_time, 'login' as activity_type
  FROM public.login_logs
  WHERE DATE(login_at) = CURRENT_DATE AND user_id IS NOT NULL
  
  UNION ALL
  
  SELECT user_id, created_at as activity_time, activity_type
  FROM public.user_activity_logs
  WHERE DATE(created_at) = CURRENT_DATE
    AND user_id IS NOT NULL
    AND activity_type IN ('page_view', 'search', 'click', 'favorite')
) all_activities
GROUP BY user_id
ORDER BY total_activities DESC;

-- 7b. 统计今日唯一用户数（这才是DAU应该显示的数字）
SELECT 
  '今日唯一活跃用户数（DAU）' as metric,
  COUNT(DISTINCT user_id)::INTEGER as value,
  '如果只有2个真实用户，这里应该显示2' as note
FROM (
  SELECT user_id FROM public.login_logs
  WHERE DATE(login_at) = CURRENT_DATE AND user_id IS NOT NULL
  UNION
  SELECT user_id FROM public.user_activity_logs
  WHERE DATE(created_at) = CURRENT_DATE
    AND user_id IS NOT NULL
    AND activity_type IN ('page_view', 'search', 'click', 'favorite')
) unique_users;

