-- ============================================
-- 验证并设置超管（Super Admin）
-- ============================================
-- 此脚本用于：
-- 1. 检查当前 admins 表结构
-- 2. 查看所有管理员及其超管状态
-- 3. 将 thushenhan@gmail.com 设置为超管
-- ============================================

-- 步骤1：检查 admins 表结构
SELECT 
  column_name, 
  data_type, 
  column_default,
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'admins'
ORDER BY ordinal_position;

-- 步骤2：查看所有管理员及其超管状态
SELECT 
  a.user_id,
  au.email,
  a.is_super_admin,
  a.created_at,
  a.created_by
FROM public.admins a
LEFT JOIN auth.users au ON a.user_id = au.id
ORDER BY a.created_at DESC;

-- 步骤3：确保 is_super_admin 字段存在（如果不存在则添加）
ALTER TABLE public.admins 
ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT FALSE;

-- 步骤4：将 thushenhan@gmail.com 设置为超管
UPDATE public.admins
SET is_super_admin = TRUE
WHERE user_id IN (
  SELECT id 
  FROM auth.users 
  WHERE email = 'thushenhan@gmail.com'
);

-- 步骤5：验证设置结果
SELECT 
  a.user_id,
  au.email,
  a.is_super_admin,
  CASE 
    WHEN a.is_super_admin = TRUE THEN '✅ 是超管'
    ELSE '❌ 不是超管'
  END as status
FROM public.admins a
LEFT JOIN auth.users au ON a.user_id = au.id
WHERE au.email = 'thushenhan@gmail.com';

-- 步骤6：查看所有超管
SELECT 
  a.user_id,
  au.email,
  a.is_super_admin,
  a.created_at
FROM public.admins a
JOIN auth.users au ON a.user_id = au.id
WHERE a.is_super_admin = TRUE;

