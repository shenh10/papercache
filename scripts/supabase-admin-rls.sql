-- ============================================
-- 管理员 RLS 策略
-- 允许管理员查看所有用户的数据
-- ============================================
-- 
-- 注意：此文件中的 is_admin() 函数已废弃
-- 现在使用 supabase-functions.sql 中的 is_admin() 函数
-- 该函数从 admins 表读取管理员列表，而不是硬编码邮箱
--
-- 如果已执行 supabase-functions.sql，则无需执行此文件
-- 如果尚未执行，请先执行 supabase-functions.sql 创建 admins 表和 is_admin() 函数
--
-- 获取当前用户的邮箱（保留此函数，可能被其他代码使用）
CREATE OR REPLACE FUNCTION get_user_email(user_id UUID)
RETURNS TEXT AS $$
BEGIN
  RETURN (SELECT email FROM auth.users WHERE id = user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 注意：is_admin() 函数现在在 supabase-functions.sql 中定义
-- 它从 admins 表读取管理员列表，不再使用硬编码邮箱
-- 请执行 supabase-functions.sql 中的 is_admin() 函数定义

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

