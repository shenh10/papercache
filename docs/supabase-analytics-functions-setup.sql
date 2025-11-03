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
    page_path,
    MAX(page_title) as page_title,
    COUNT(*)::INTEGER as view_count,
    COUNT(DISTINCT COALESCE(user_id::TEXT, session_id))::INTEGER as unique_visitors
  FROM user_activity_logs
  WHERE activity_type = 'page_view'
    AND DATE(created_at) BETWEEN p_start_date AND p_end_date
    AND page_path IS NOT NULL
  GROUP BY page_path
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
    search_query,
    COUNT(*)::INTEGER as search_count,
    COUNT(DISTINCT COALESCE(user_id::TEXT, session_id))::INTEGER as unique_searchers
  FROM user_activity_logs
  WHERE activity_type = 'search'
    AND DATE(created_at) BETWEEN p_start_date AND p_end_date
    AND search_query IS NOT NULL
    AND search_query != ''
  GROUP BY search_query
  ORDER BY search_count DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 授予函数执行权限
-- ============================================

GRANT EXECUTE ON FUNCTION get_popular_pages(DATE, DATE, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_search_keywords(DATE, DATE, INTEGER) TO anon, authenticated;

