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

-- 策略3: 用户只能删除自己的收藏
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
-- 管理员权限（可选）
-- ============================================

-- 创建一个函数来检查管理员权限
-- 管理员列表可以从配置表或环境变量中读取
-- 这里使用简单的邮箱白名单方式

CREATE OR REPLACE FUNCTION is_admin(user_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- 这里可以从配置表读取管理员列表
  -- 暂时使用硬编码的方式，后续可以从配置文件读取
  RETURN user_email IN (
    'thushenhan@gmail.com'  -- 替换为实际管理员邮箱
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 为管理员添加查看所有数据的策略（可选，如果需要）
-- 注意：需要先创建管理员表或在配置中存储管理员列表

