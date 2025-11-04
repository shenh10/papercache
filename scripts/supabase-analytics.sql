-- 用户活跃度分析表和函数
-- 在Supabase Dashboard的SQL Editor中执行

-- ============================================
-- 创建用户活动日志表
-- ============================================

CREATE TABLE IF NOT EXISTS user_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT, -- 会话ID，用于追踪匿名用户
  activity_type TEXT NOT NULL, -- 'page_view', 'search', 'click', 'favorite', etc.
  page_path TEXT, -- 访问的页面路径
  page_title TEXT, -- 页面标题
  search_query TEXT, -- 搜索关键词（如果是搜索行为）
  target_url TEXT, -- 点击/操作的目标URL
  referrer TEXT, -- 来源页面
  ip_address INET,
  user_agent TEXT,
  metadata JSONB, -- 额外的元数据（设备信息、屏幕尺寸等）
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON user_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_session_id ON user_activity_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_activity_type ON user_activity_logs(activity_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON user_activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_page_path ON user_activity_logs(page_path);

-- 启用Row Level Security
ALTER TABLE user_activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS策略：用户只能查看自己的活动记录，管理员可以查看所有
-- 注意：由于使用 SECURITY DEFINER，函数执行时会绕过 RLS，但仍需要基本策略
DROP POLICY IF EXISTS "Users can view own activity" ON user_activity_logs;
CREATE POLICY "Users can view own activity"
  ON user_activity_logs FOR SELECT
  USING (
    auth.uid() = user_id OR
    user_id IS NULL OR
    true -- 暂时允许所有人查看，用于统计分析（函数使用 SECURITY DEFINER 会绕过 RLS）
  );

-- RLS策略：所有人都可以插入自己的活动记录（包括匿名用户）
DROP POLICY IF EXISTS "Anyone can log activity" ON user_activity_logs;
CREATE POLICY "Anyone can log activity"
  ON user_activity_logs FOR INSERT
  WITH CHECK (true);

-- ============================================
-- 创建会话表（用于追踪匿名用户会话）
-- ============================================

CREATE TABLE IF NOT EXISTS user_sessions (
  id TEXT PRIMARY KEY, -- session ID (UUID string)
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address INET,
  user_agent TEXT,
  first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  page_views INTEGER DEFAULT 0,
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_last_seen ON user_sessions(last_seen_at DESC);

ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- 所有人都可以插入和更新会话
DROP POLICY IF EXISTS "Anyone can manage sessions" ON user_sessions;
CREATE POLICY "Anyone can manage sessions"
  ON user_sessions FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 分析函数：日活跃用户（DAU）
-- 修复：正确统计已登录用户和匿名用户，确保去重
-- 已登录用户：通过 user_id 标识（需要在 profiles 表中存在）
-- 匿名用户：通过 session_id 标识（user_id IS NULL 时）
-- 整合 login_logs 和 user_activity_logs 两个数据源
-- 注意：使用与 comprehensive 函数一致的逻辑，确保统计口径一致
-- ============================================

CREATE OR REPLACE FUNCTION get_daily_active_users(
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(DISTINCT user_identifier)::INTEGER
    FROM (
      -- 从 login_logs 获取今日登录的用户（已登录用户）
      SELECT DISTINCT 
        ll.user_id::TEXT as user_identifier
      FROM public.login_logs ll
      INNER JOIN public.profiles p ON ll.user_id = p.id  -- 只统计真实存在的用户
      WHERE DATE(ll.login_at) = p_date
        AND ll.user_id IS NOT NULL

      UNION

      -- 从 user_activity_logs 获取今日有活动的用户
      -- 已登录用户：使用 user_id（验证在 profiles 中存在），匿名用户：使用 session_id
      SELECT DISTINCT
        CASE 
          WHEN ual.user_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.profiles p WHERE p.id = ual.user_id
          ) THEN ual.user_id::TEXT
          WHEN ual.user_id IS NULL AND ual.session_id IS NOT NULL THEN 'anon_' || ual.session_id
          ELSE NULL
        END as user_identifier
      FROM public.user_activity_logs ual
      WHERE DATE(ual.created_at) = p_date
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
    ) active_users
    WHERE user_identifier IS NOT NULL  -- 排除无效记录
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 分析函数：获取指定日期范围内的活跃用户数
-- 修复：正确统计已登录用户和匿名用户，确保去重
-- 已登录用户：通过 user_id 标识（需要在 profiles 表中存在）
-- 匿名用户：通过 session_id 标识（user_id IS NULL 时）
-- 整合 login_logs 和 user_activity_logs 两个数据源
-- ============================================

CREATE OR REPLACE FUNCTION get_active_users_in_range(
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE(
  date DATE,
  active_users INTEGER,
  authenticated_users INTEGER,
  anonymous_users INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH daily_activities AS (
    SELECT
      DATE(activity_date) as activity_date,
      user_identifier,
      is_authenticated
    FROM (
      -- login_logs 数据（已登录用户）
      SELECT
        ll.login_at as activity_date,
        ll.user_id::TEXT as user_identifier,
        true as is_authenticated
      FROM public.login_logs ll
      INNER JOIN public.profiles p ON ll.user_id = p.id  -- 只统计真实存在的用户
      WHERE DATE(ll.login_at) BETWEEN p_start_date AND p_end_date
        AND ll.user_id IS NOT NULL

      UNION

      -- user_activity_logs 数据
      -- 已登录用户：使用 user_id，匿名用户：使用 session_id
      SELECT
        ual.created_at as activity_date,
        COALESCE(ual.user_id::TEXT, 'anon_' || ual.session_id) as user_identifier,
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
  )
  SELECT
    activity_date as date,
    COUNT(DISTINCT user_identifier)::INTEGER as active_users,  -- 总活跃用户数（已登录+匿名）
    COUNT(DISTINCT user_identifier) FILTER (WHERE is_authenticated)::INTEGER as authenticated_users,  -- 已登录用户数
    COUNT(DISTINCT user_identifier) FILTER (WHERE NOT is_authenticated)::INTEGER as anonymous_users  -- 匿名用户数
  FROM daily_activities
  GROUP BY activity_date
  ORDER BY activity_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 分析函数：获取热门页面
-- ============================================

CREATE OR REPLACE FUNCTION get_popular_pages(
  p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '7 days',
  p_end_date DATE DEFAULT CURRENT_DATE,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE(
  page_path TEXT,
  page_title TEXT,
  view_count INTEGER,
  unique_visitors INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ual.page_path,
    MAX(ual.page_title) as page_title,
    COUNT(*)::INTEGER as view_count,
    COUNT(DISTINCT COALESCE(ual.user_id::TEXT, ual.session_id))::INTEGER as unique_visitors
  FROM user_activity_logs ual
  WHERE ual.activity_type = 'page_view'
    AND DATE(ual.created_at) BETWEEN p_start_date AND p_end_date
    AND ual.page_path IS NOT NULL
  GROUP BY ual.page_path
  ORDER BY view_count DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 分析函数：获取搜索热词
-- ============================================

CREATE OR REPLACE FUNCTION get_search_keywords(
  p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '7 days',
  p_end_date DATE DEFAULT CURRENT_DATE,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE(
  search_query TEXT,
  search_count INTEGER,
  unique_searchers INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ual.search_query,
    COUNT(*)::INTEGER as search_count,
    COUNT(DISTINCT COALESCE(ual.user_id::TEXT, ual.session_id))::INTEGER as unique_searchers
  FROM user_activity_logs ual
  WHERE ual.activity_type = 'search'
    AND DATE(ual.created_at) BETWEEN p_start_date AND p_end_date
    AND ual.search_query IS NOT NULL
    AND ual.search_query != ''
  GROUP BY ual.search_query
  ORDER BY search_count DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 分析函数：获取用户留存率
-- ============================================

CREATE OR REPLACE FUNCTION get_user_retention(
  p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  cohort_date DATE,
  total_users INTEGER,
  day_1_retention INTEGER,
  day_7_retention INTEGER,
  day_30_retention INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH first_visits AS (
    SELECT
      COALESCE(user_id::TEXT, session_id) as user_identifier,
      DATE(MIN(created_at)) as first_visit_date
    FROM user_activity_logs
    WHERE DATE(created_at) BETWEEN p_start_date AND p_end_date
    GROUP BY COALESCE(user_id::TEXT, session_id)
  ),
  cohort_activity AS (
    SELECT
      fv.first_visit_date as cohort_date,
      fv.user_identifier,
      DATE(a.created_at) as activity_date
    FROM first_visits fv
    LEFT JOIN user_activity_logs a
      ON COALESCE(a.user_id::TEXT, a.session_id) = fv.user_identifier
      AND DATE(a.created_at) BETWEEN fv.first_visit_date AND fv.first_visit_date + INTERVAL '30 days'
  )
  SELECT
    cohort_date,
    COUNT(DISTINCT user_identifier)::INTEGER as total_users,
    COUNT(DISTINCT user_identifier) FILTER (
      WHERE activity_date = cohort_date + INTERVAL '1 day'
    )::INTEGER as day_1_retention,
    COUNT(DISTINCT user_identifier) FILTER (
      WHERE activity_date BETWEEN cohort_date + INTERVAL '1 day' AND cohort_date + INTERVAL '7 days'
    )::INTEGER as day_7_retention,
    COUNT(DISTINCT user_identifier) FILTER (
      WHERE activity_date BETWEEN cohort_date + INTERVAL '1 day' AND cohort_date + INTERVAL '30 days'
    )::INTEGER as day_30_retention
  FROM cohort_activity
  GROUP BY cohort_date
  ORDER BY cohort_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 记录用户活动的函数
-- ============================================

CREATE OR REPLACE FUNCTION log_user_activity(
  p_session_id TEXT,
  p_activity_type TEXT,
  p_user_id UUID DEFAULT NULL,
  p_page_path TEXT DEFAULT NULL,
  p_page_title TEXT DEFAULT NULL,
  p_search_query TEXT DEFAULT NULL,
  p_target_url TEXT DEFAULT NULL,
  p_referrer TEXT DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO user_activity_logs (
    user_id,
    session_id,
    activity_type,
    page_path,
    page_title,
    search_query,
    target_url,
    referrer,
    ip_address,
    user_agent,
    metadata
  )
  VALUES (
    p_user_id,
    p_session_id,
    p_activity_type,
    p_page_path,
    p_page_title,
    p_search_query,
    p_target_url,
    p_referrer,
    p_ip_address,
    p_user_agent,
    p_metadata
  )
  RETURNING id INTO log_id;
  
  -- 更新会话信息
  INSERT INTO user_sessions (id, user_id, ip_address, user_agent, last_seen_at, page_views)
  VALUES (
    p_session_id,
    p_user_id,
    p_ip_address,
    p_user_agent,
    NOW(),
    1
  )
  ON CONFLICT (id) DO UPDATE SET
    last_seen_at = NOW(),
    page_views = user_sessions.page_views + 1,
    user_id = COALESCE(user_sessions.user_id, p_user_id); -- 如果用户登录了，更新user_id
  
  RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 授予函数执行权限
GRANT EXECUTE ON FUNCTION log_user_activity TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_daily_active_users TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_active_users_in_range TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_popular_pages TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_search_keywords TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_user_retention TO anon, authenticated;

