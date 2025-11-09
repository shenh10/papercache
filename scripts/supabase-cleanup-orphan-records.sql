-- Supabase 清理孤儿记录的函数
-- 用于删除指向不存在文章的收藏和点击统计记录

-- 函数：清理无效的收藏记录
-- 接收一个有效的 post_url 数组，删除不在这个数组中的所有收藏记录
CREATE OR REPLACE FUNCTION cleanup_invalid_favorites(p_valid_urls TEXT[])
RETURNS TABLE(deleted_count BIGINT, deleted_urls TEXT[]) AS $$
DECLARE
  deleted_records RECORD;
  deleted_urls_list TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- 删除不在有效URL列表中的收藏记录
  WITH deleted AS (
    DELETE FROM favorites
    WHERE post_url NOT IN (SELECT unnest(p_valid_urls))
    RETURNING post_url, id
  )
  SELECT COUNT(*), array_agg(post_url)
  INTO deleted_count, deleted_urls_list
  FROM deleted;
  
  RETURN QUERY SELECT deleted_count, deleted_urls_list;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 函数：清理无效的点击统计记录
-- 接收一个有效的 post_url 数组，删除不在这个数组中的所有点击统计记录
CREATE OR REPLACE FUNCTION cleanup_invalid_click_stats(p_valid_urls TEXT[])
RETURNS TABLE(deleted_count BIGINT, deleted_urls TEXT[]) AS $$
DECLARE
  deleted_records RECORD;
  deleted_urls_list TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- 删除不在有效URL列表中的点击统计记录
  WITH deleted AS (
    DELETE FROM post_clicks
    WHERE post_url NOT IN (SELECT unnest(p_valid_urls))
    RETURNING post_url, id
  )
  SELECT COUNT(*), array_agg(post_url)
  INTO deleted_count, deleted_urls_list
  FROM deleted;
  
  RETURN QUERY SELECT deleted_count, deleted_urls_list;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 函数：批量清理所有无效记录（同时清理收藏和点击统计）
CREATE OR REPLACE FUNCTION cleanup_all_invalid_records(p_valid_urls TEXT[])
RETURNS TABLE(
  favorites_deleted BIGINT,
  favorites_urls TEXT[],
  clicks_deleted BIGINT,
  clicks_urls TEXT[]
) AS $$
DECLARE
  fav_result RECORD;
  click_result RECORD;
BEGIN
  -- 清理收藏记录
  SELECT * INTO fav_result
  FROM cleanup_invalid_favorites(p_valid_urls);
  
  -- 清理点击统计记录
  SELECT * INTO click_result
  FROM cleanup_invalid_click_stats(p_valid_urls);
  
  RETURN QUERY SELECT 
    fav_result.deleted_count,
    fav_result.deleted_urls,
    click_result.deleted_count,
    click_result.deleted_urls;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 授予执行权限（如果需要，可以限制特定角色）
-- GRANT EXECUTE ON FUNCTION cleanup_invalid_favorites TO authenticated;
-- GRANT EXECUTE ON FUNCTION cleanup_invalid_click_stats TO authenticated;
-- GRANT EXECUTE ON FUNCTION cleanup_all_invalid_records TO authenticated;



