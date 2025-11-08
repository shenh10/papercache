-- ============================================
-- 设置超管（Super Admin）
-- ============================================
-- 使用此脚本将指定用户设置为超管
-- 
-- 使用步骤：
-- 1. 确保已执行 supabase-add-super-admin.sql
-- 2. 替换下面的邮箱为实际的管理员邮箱
-- 3. 执行此脚本
-- ============================================

-- 方法1：通过邮箱查找用户ID并设置为超管（推荐）
-- 替换 'thushenhan@gmail.com' 为实际的超管邮箱
UPDATE public.admins
SET is_super_admin = TRUE
WHERE user_id IN (
  SELECT id 
  FROM auth.users 
  WHERE email = 'thushenhan@gmail.com'
);

-- 方法2：直接使用用户ID设置超管
-- 替换 'YOUR_ADMIN_USER_ID' 为实际的管理员用户ID
-- UPDATE public.admins
-- SET is_super_admin = TRUE
-- WHERE user_id = 'YOUR_ADMIN_USER_ID';

-- ============================================
-- 验证超管设置是否成功
-- ============================================
SELECT 
  a.user_id,
  au.email,
  a.is_super_admin,
  a.created_at
FROM public.admins a
JOIN auth.users au ON a.user_id = au.id
WHERE a.is_super_admin = TRUE;

-- ============================================
-- 如果需要移除超管权限（仅用于紧急情况）
-- ============================================
-- 注意：只有数据库管理员或通过 set_super_admin 函数才能移除超管
-- 下面的语句需要直接数据库访问权限
-- UPDATE public.admins
-- SET is_super_admin = FALSE
-- WHERE user_id IN (
--   SELECT id 
--   FROM auth.users 
--   WHERE email = 'thushenhan@gmail.com'
-- );

