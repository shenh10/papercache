-- ============================================
-- 管理员 RLS 策略
-- 允许管理员查看所有用户的数据
-- ============================================

-- 获取当前用户的邮箱
CREATE OR REPLACE FUNCTION get_user_email(user_id UUID)
RETURNS TEXT AS $$
BEGIN
  RETURN (SELECT email FROM auth.users WHERE id = user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 检查是否为管理员
CREATE OR REPLACE FUNCTION is_admin(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
DECLARE
  user_email TEXT;
BEGIN
  IF user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  user_email := get_user_email(user_id);
  
  -- 管理员邮箱列表（可以从配置文件或环境变量读取）
  RETURN user_email IN (
    'thushenhan@gmail.com'  -- 替换为实际管理员邮箱列表
    -- 可以添加更多管理员邮箱
    -- 'admin2@example.com',
    -- 'admin3@example.com'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- favorites 表：管理员可以查看所有收藏
-- ============================================

DROP POLICY IF EXISTS "Admins can view all favorites" ON favorites;
CREATE POLICY "Admins can view all favorites"
  ON favorites FOR SELECT
  USING (is_admin());

-- 注意：这个策略会覆盖原来的 "Users can view own favorites" 策略
-- 管理员既可以通过 is_admin() 查看所有，也可以通过 user_id 查看自己的
-- 普通用户仍然只能查看自己的收藏（通过原有的策略）

-- ============================================
-- login_logs 表：管理员可以查看所有登录日志
-- ============================================

DROP POLICY IF EXISTS "Admins can view all login logs" ON login_logs;
CREATE POLICY "Admins can view all login logs"
  ON login_logs FOR SELECT
  USING (is_admin());

-- ============================================
-- user_activity_logs 表：管理员可以查看所有活动日志
-- ============================================

-- 如果 user_activity_logs 表有 RLS，也需要添加管理员策略
DROP POLICY IF EXISTS "Admins can view all activity logs" ON user_activity_logs;
CREATE POLICY "Admins can view all activity logs"
  ON user_activity_logs FOR SELECT
  USING (is_admin());

