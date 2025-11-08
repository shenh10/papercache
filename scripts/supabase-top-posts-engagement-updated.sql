-- 更新获取"最多关注"文章的PostgreSQL函数
-- 在Supabase Dashboard的SQL Editor中执行
-- 
-- 功能：获取按点击量/收藏量/点赞数排序的Top N文章
-- 参数：limit_count - 返回的文章数量（默认10）
-- 返回：JSON数组，包含 post_url, click_count, favorite_count, like_count, total_count
-- 
-- 注意：此函数支持按不同指标排序，但排序逻辑在前端实现
-- 
-- 注意：由于返回类型改变（添加了 like_count 列），需要先删除旧函数

DROP FUNCTION IF EXISTS public.get_top_posts_by_engagement(INTEGER);

CREATE FUNCTION public.get_top_posts_by_engagement(limit_count INTEGER DEFAULT 10)
RETURNS TABLE(
  post_url TEXT,
  click_count BIGINT,
  favorite_count BIGINT,
  like_count BIGINT,
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
    ),
    like_stats AS (
      SELECT likes.post_url AS url, COUNT(*)::BIGINT AS likes_count
      FROM likes
      GROUP BY likes.post_url
    )
    SELECT 
      COALESCE(c.url, f.url, l.url) AS result_url,
      COALESCE(c.clicks, 0)::BIGINT AS result_clicks,
      COALESCE(f.favs, 0)::BIGINT AS result_favs,
      COALESCE(l.likes_count, 0)::BIGINT AS result_likes,
      (COALESCE(c.clicks, 0) + COALESCE(f.favs, 0) + COALESCE(l.likes_count, 0))::BIGINT AS result_total
    FROM click_stats c
    FULL OUTER JOIN favorite_stats f ON c.url = f.url
    FULL OUTER JOIN like_stats l ON COALESCE(c.url, f.url) = l.url
    WHERE (COALESCE(c.clicks, 0) + COALESCE(f.favs, 0) + COALESCE(l.likes_count, 0)) > 0
    -- 默认按点赞数排序（前端可以重新排序）
    ORDER BY result_likes DESC, 
             result_clicks DESC, 
             result_favs DESC
    LIMIT limit_count
  LOOP
    post_url := result_record.result_url;
    click_count := result_record.result_clicks;
    favorite_count := result_record.result_favs;
    like_count := result_record.result_likes;
    total_count := result_record.result_total;
    RETURN NEXT;
  END LOOP;
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 确保函数可以被匿名用户调用（如果需要）
-- 如果 favorites、likes 和 post_clicks 表都有适当的 RLS 策略允许读取，则无需额外授权
-- GRANT EXECUTE ON FUNCTION public.get_top_posts_by_engagement(INTEGER) TO anon, authenticated;

