-- ============================================
-- 创建点赞表
-- ============================================
-- 在Supabase Dashboard的SQL Editor中执行此文件

-- 创建点赞表
CREATE TABLE IF NOT EXISTS likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, post_url)
);

-- 启用Row Level Security
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON likes(user_id);
CREATE INDEX IF NOT EXISTS idx_likes_post_url ON likes(post_url);
CREATE INDEX IF NOT EXISTS idx_likes_created_at ON likes(created_at DESC);

-- 添加注释
COMMENT ON TABLE likes IS '用户点赞记录表';
COMMENT ON COLUMN likes.user_id IS '用户ID';
COMMENT ON COLUMN likes.post_url IS '论文URL';
COMMENT ON COLUMN likes.created_at IS '点赞时间';

-- ============================================
-- RLS策略：用户只能查看和管理自己的点赞
-- ============================================

-- 允许用户查看自己的点赞
DROP POLICY IF EXISTS "Users can view their own likes" ON likes;
CREATE POLICY "Users can view their own likes"
  ON likes FOR SELECT
  USING (auth.uid() = user_id);

-- 允许用户创建自己的点赞
DROP POLICY IF EXISTS "Users can insert their own likes" ON likes;
CREATE POLICY "Users can insert their own likes"
  ON likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 允许用户删除自己的点赞
DROP POLICY IF EXISTS "Users can delete their own likes" ON likes;
CREATE POLICY "Users can delete their own likes"
  ON likes FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 点赞统计函数（用于管理员和公开统计）
-- ============================================

-- 获取单个论文的点赞数
CREATE OR REPLACE FUNCTION get_like_count(p_url TEXT)
RETURNS INTEGER AS $$
DECLARE
  count_result INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER
  INTO count_result
  FROM likes
  WHERE post_url = p_url;
  
  RETURN COALESCE(count_result, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 批量获取多个论文的点赞数
CREATE OR REPLACE FUNCTION batch_get_like_counts(p_urls TEXT[])
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_object_agg(post_url, like_count)
  INTO result
  FROM (
    SELECT 
      post_url,
      COUNT(*)::INTEGER as like_count
    FROM likes
    WHERE post_url = ANY(p_urls)
    GROUP BY post_url
  ) counts;
  
  RETURN COALESCE(result, '{}'::JSON);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 批量检查用户点赞状态
CREATE OR REPLACE FUNCTION batch_check_user_likes(p_user_id UUID, p_urls TEXT[])
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_object_agg(post_url, true)
  INTO result
  FROM (
    SELECT DISTINCT post_url
    FROM likes
    WHERE user_id = p_user_id
      AND post_url = ANY(p_urls)
  ) user_likes;
  
  RETURN COALESCE(result, '{}'::JSON);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 获取总点赞数（所有用户，用于管理员统计）
CREATE OR REPLACE FUNCTION get_total_likes_count()
RETURNS INTEGER AS $$
DECLARE
  count_result INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER
  INTO count_result
  FROM likes;
  
  RETURN COALESCE(count_result, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 获取点赞统计（按论文分组，用于管理员页面）
CREATE OR REPLACE FUNCTION get_likes_stats_by_post()
RETURNS TABLE(
  post_url TEXT,
  like_count BIGINT,
  first_liked TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.post_url,
    COUNT(*)::BIGINT as like_count,
    MIN(l.created_at) as first_liked
  FROM likes l
  GROUP BY l.post_url
  ORDER BY like_count DESC, first_liked DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 授予函数执行权限
GRANT EXECUTE ON FUNCTION get_like_count(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION batch_get_like_counts(TEXT[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION batch_check_user_likes(UUID, TEXT[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_total_likes_count() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_likes_stats_by_post() TO authenticated;

-- 添加注释
COMMENT ON FUNCTION get_like_count(TEXT) IS '获取单个论文的点赞数';
COMMENT ON FUNCTION batch_get_like_counts(TEXT[]) IS '批量获取多个论文的点赞数，返回JSON对象';
COMMENT ON FUNCTION batch_check_user_likes(UUID, TEXT[]) IS '批量检查用户点赞状态，返回JSON对象';
COMMENT ON FUNCTION get_total_likes_count() IS '获取所有用户的总点赞数，绕过RLS策略限制';
COMMENT ON FUNCTION get_likes_stats_by_post() IS '获取点赞统计（按论文分组），用于管理员页面';

