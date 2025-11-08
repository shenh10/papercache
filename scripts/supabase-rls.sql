-- Row Level Security (RLS) 策略
-- 在Supabase Dashboard的SQL Editor中执行

-- ============================================
-- profiles表策略
-- ============================================

-- 策略1: 所有用户都可以查看所有用户档案
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

-- 策略2: 用户可以插入自己的档案
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 策略3: 用户只能更新自己的档案
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 策略4: 用户可以删除自己的档案
DROP POLICY IF EXISTS "Users can delete own profile" ON profiles;
CREATE POLICY "Users can delete own profile"
  ON profiles FOR DELETE
  USING (auth.uid() = id);

-- ============================================
-- favorites表策略
-- ============================================

-- 策略1: 用户只能查看自己的收藏
DROP POLICY IF EXISTS "Users can view own favorites" ON favorites;
CREATE POLICY "Users can view own favorites"
  ON favorites FOR SELECT
  USING (auth.uid() = user_id);

-- 策略2: 用户只能添加自己的收藏
DROP POLICY IF EXISTS "Users can insert own favorites" ON favorites;
CREATE POLICY "Users can insert own favorites"
  ON favorites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 策略3: 用户可以更新自己的收藏（包括 is_read 和 read_at 字段）
DROP POLICY IF EXISTS "Users can update own favorites" ON favorites;
CREATE POLICY "Users can update own favorites"
  ON favorites FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 策略4: 用户只能删除自己的收藏
DROP POLICY IF EXISTS "Users can delete own favorites" ON favorites;
CREATE POLICY "Users can delete own favorites"
  ON favorites FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- login_logs表策略
-- ============================================

-- 策略1: 用户只能查看自己的登录日志
DROP POLICY IF EXISTS "Users can view own login logs" ON login_logs;
CREATE POLICY "Users can view own login logs"
  ON login_logs FOR SELECT
  USING (auth.uid() = user_id);

-- 策略2: 系统可以插入登录日志（通过触发器或函数）
DROP POLICY IF EXISTS "System can insert login logs" ON login_logs;
CREATE POLICY "System can insert login logs"
  ON login_logs FOR INSERT
  WITH CHECK (true);

-- ============================================
-- 管理员权限（已废弃）
-- ============================================
--
-- 注意：此文件中的 is_admin() 函数已废弃
-- 现在使用 supabase-functions.sql 中的 is_admin() 函数
-- 该函数从 admins 表读取管理员列表，而不是硬编码邮箱
--
-- 如果已执行 supabase-functions.sql，则无需执行下面的代码
-- 如果尚未执行，请先执行 supabase-functions.sql 创建 admins 表和 is_admin() 函数
--
-- 旧的硬编码邮箱方式（已废弃）：
-- CREATE OR REPLACE FUNCTION is_admin(user_email TEXT)
-- RETURNS BOOLEAN AS $$
-- BEGIN
--   RETURN user_email IN ('thushenhan@gmail.com');
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;


