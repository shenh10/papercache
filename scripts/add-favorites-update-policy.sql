-- ============================================
-- 为 favorites 表添加 UPDATE RLS 策略
-- ============================================
-- 在Supabase Dashboard的SQL Editor中执行此文件
-- 
-- 问题：favorites 表缺少 UPDATE 策略，导致无法更新 is_read 字段
-- 解决：添加允许用户更新自己收藏的策略

-- 策略：用户可以更新自己的收藏（包括 is_read 和 read_at 字段）
DROP POLICY IF EXISTS "Users can update own favorites" ON favorites;
CREATE POLICY "Users can update own favorites"
  ON favorites FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 添加注释
COMMENT ON POLICY "Users can update own favorites" ON favorites IS 
'允许用户更新自己的收藏记录，包括 is_read 和 read_at 字段。';

