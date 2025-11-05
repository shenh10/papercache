-- 创建获取"最多关注"文章的PostgreSQL函数
-- 在Supabase Dashboard的SQL Editor中执行
-- 
-- 功能：获取按点击量+收藏量总和排序的Top N文章
-- 参数：limit_count - 返回的文章数量（默认10）
-- 返回：JSON数组，包含 post_url, click_count, favorite_count, total_count

CREATE OR REPLACE FUNCTION public.get_top_posts_by_engagement(limit_count INTEGER DEFAULT 10)
RETURNS TABLE(
  post_url TEXT,
  click_count BIGINT,
  favorite_count BIGINT,
  total_count BIGINT
) AS $$
DECLARE
  result_record RECORD;
BEGIN
  FOR result_record IN
    WITH click_stats AS (
      SELECT post_clicks.post_url AS url, SUM(post_clicks.click_count) AS clicks
      FROM post_clicks
      GROUP BY post_clicks.post_url
    ),
    favorite_stats AS (
      SELECT favorites.post_url AS url, COUNT(*)::BIGINT AS favs
      FROM favorites
      GROUP BY favorites.post_url
    )
    SELECT 
      COALESCE(c.url, f.url) AS result_url,
      COALESCE(c.clicks, 0)::BIGINT AS result_clicks,
      COALESCE(f.favs, 0)::BIGINT AS result_favs,
      (COALESCE(c.clicks, 0) + COALESCE(f.favs, 0))::BIGINT AS result_total
    FROM click_stats c
    FULL OUTER JOIN favorite_stats f ON c.url = f.url
    WHERE (COALESCE(c.clicks, 0) + COALESCE(f.favs, 0)) > 0
    -- 按总排序（点击量+收藏量）降序排列，数值大的在前
    ORDER BY result_total DESC, 
             result_clicks DESC, 
             result_favs DESC
    LIMIT limit_count
  LOOP
    post_url := result_record.result_url;
    click_count := result_record.result_clicks;
    favorite_count := result_record.result_favs;
    total_count := result_record.result_total;
    RETURN NEXT;
  END LOOP;
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 确保函数可以被匿名用户调用（如果需要）
-- 如果 favorites 和 post_clicks 表都有适当的 RLS 策略允许读取，则无需额外授权
-- GRANT EXECUTE ON FUNCTION public.get_top_posts_by_engagement(INTEGER) TO anon, authenticated;

