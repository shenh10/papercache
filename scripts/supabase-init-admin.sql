-- ============================================
-- 初始化第一个管理员
-- ============================================
-- 首次部署后，使用此脚本初始化第一个管理员
-- 
-- 使用步骤：
-- 1. 确保已执行 supabase-functions.sql 中的表创建语句
-- 2. 执行此脚本插入第一个管理员
-- 3. 插入完成后，建议删除临时策略以增强安全性
--
-- ============================================

-- 方法1：通过邮箱查找用户ID并插入（推荐）
-- 替换 'your-admin-email@example.com' 为实际的管理员邮箱
INSERT INTO public.admins (user_id, created_by)
SELECT id, id 
FROM auth.users 
WHERE email = 'your-admin-email@example.com'
ON CONFLICT (user_id) DO NOTHING;

-- 方法2：直接使用用户ID插入
-- 替换 'YOUR_ADMIN_USER_ID' 为实际的管理员用户ID
-- INSERT INTO public.admins (user_id, created_by)
-- VALUES ('YOUR_ADMIN_USER_ID', 'YOUR_ADMIN_USER_ID')
-- ON CONFLICT (user_id) DO NOTHING;

-- ============================================
-- 验证管理员是否插入成功
-- ============================================
SELECT 
  a.user_id,
  au.email,
  a.created_at,
  a.created_by
FROM public.admins a
JOIN auth.users au ON a.user_id = au.id;

-- ============================================
-- 安全加固：删除临时初始化策略（可选）
-- ============================================
-- 首次管理员插入完成后，建议删除临时策略以增强安全性
-- 取消下面的注释来删除临时策略：
--
-- DROP POLICY IF EXISTS "Initial admin setup (temporary)" ON public.admins;


