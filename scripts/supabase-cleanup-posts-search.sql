-- Supabase 清理 posts_search 表中的无效记录
-- 用于删除指向不存在文章的搜索记录

-- 函数：清理 posts_search 表中的无效记录
-- 接收一个有效的 post_url 数组，删除不在这个数组中的所有搜索记录
CREATE OR REPLACE FUNCTION cleanup_invalid_posts_search(p_valid_urls TEXT[])
RETURNS TABLE(deleted_count BIGINT, deleted_urls TEXT[]) AS $$
DECLARE
  deleted_records RECORD;
  deleted_urls_list TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- 删除不在有效URL列表中的搜索记录
  WITH deleted AS (
    DELETE FROM posts_search
    WHERE post_url NOT IN (SELECT unnest(p_valid_urls))
    RETURNING post_url, id
  )
  SELECT COUNT(*), array_agg(post_url)
  INTO deleted_count, deleted_urls_list
  FROM deleted;
  
  RETURN QUERY SELECT deleted_count, deleted_urls_list;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 添加函数注释
COMMENT ON FUNCTION cleanup_invalid_posts_search IS '清理 posts_search 表中的无效记录（指向不存在文章的记录）';

-- 授予执行权限（如果需要，可以限制特定角色）
-- GRANT EXECUTE ON FUNCTION cleanup_invalid_posts_search TO authenticated;

