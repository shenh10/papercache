-- ============================================
-- 添加超管（Super Admin）支持
-- ============================================
-- 此脚本为管理员系统添加超管保护机制
-- 超管不能被其他管理员移除，只有超管可以移除其他管理员
--
-- 使用步骤：
-- 1. 执行此脚本添加 is_super_admin 字段
-- 2. 执行 supabase-set-super-admin.sql 设置超管
-- ============================================

-- 添加 is_super_admin 字段到 admins 表
ALTER TABLE public.admins 
ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT FALSE;

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_admins_is_super_admin 
ON public.admins(is_super_admin) 
WHERE is_super_admin = TRUE;

-- 更新 remove_admin 函数，添加超管保护
CREATE OR REPLACE FUNCTION public.remove_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  current_admin_id UUID;
  admin_count INTEGER;
  target_is_super_admin BOOLEAN;
  current_is_super_admin BOOLEAN;
BEGIN
  -- 检查当前用户是否为管理员
  current_admin_id := auth.uid();
  IF NOT EXISTS (SELECT 1 FROM public.admins WHERE user_id = current_admin_id) THEN
    RAISE EXCEPTION 'Only admins can remove other admins';
  END IF;

  -- 检查目标用户是否为超管
  SELECT COALESCE(is_super_admin, FALSE) INTO target_is_super_admin
  FROM public.admins
  WHERE user_id = p_user_id;

  -- 检查当前用户是否为超管
  SELECT COALESCE(is_super_admin, FALSE) INTO current_is_super_admin
  FROM public.admins
  WHERE user_id = current_admin_id;

  -- 超管不能被移除（除非是超管自己移除自己，但也不能移除自己）
  IF target_is_super_admin = TRUE THEN
    RAISE EXCEPTION 'Cannot remove super admin';
  END IF;

  -- 只有超管可以移除其他管理员（普通管理员不能移除其他管理员）
  IF current_is_super_admin = FALSE THEN
    RAISE EXCEPTION 'Only super admin can remove other admins';
  END IF;

  -- 检查是否为最后一个管理员
  SELECT COUNT(*) INTO admin_count FROM public.admins;
  IF admin_count <= 1 THEN
    RAISE EXCEPTION 'Cannot remove the last admin';
  END IF;

  -- 不能移除自己
  IF p_user_id = current_admin_id THEN
    RAISE EXCEPTION 'Cannot remove yourself as admin';
  END IF;

  -- 删除管理员记录
  DELETE FROM public.admins WHERE user_id = p_user_id;

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to remove admin: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 更新 add_admin 函数，只有超管可以添加管理员
CREATE OR REPLACE FUNCTION public.add_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  current_admin_id UUID;
  current_is_super_admin BOOLEAN;
BEGIN
  -- 检查当前用户是否为管理员
  current_admin_id := auth.uid();
  IF NOT EXISTS (SELECT 1 FROM public.admins WHERE user_id = current_admin_id) THEN
    RAISE EXCEPTION 'Only admins can add other admins';
  END IF;

  -- 检查当前用户是否为超管
  SELECT COALESCE(is_super_admin, FALSE) INTO current_is_super_admin
  FROM public.admins
  WHERE user_id = current_admin_id;

  -- 只有超管可以添加管理员
  IF current_is_super_admin = FALSE THEN
    RAISE EXCEPTION 'Only super admin can add other admins';
  END IF;

  -- 检查目标用户是否存在
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User does not exist';
  END IF;

  -- 插入管理员记录（如果不存在），默认不是超管
  INSERT INTO public.admins (user_id, created_by, is_super_admin)
  VALUES (p_user_id, current_admin_id, FALSE)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to add admin: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 添加函数：检查用户是否为超管
CREATE OR REPLACE FUNCTION public.is_super_admin(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  IF check_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN EXISTS (
    SELECT 1 FROM public.admins a
    WHERE a.user_id = check_user_id 
    AND COALESCE(a.is_super_admin, FALSE) = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 添加函数：设置超管（只能由现有超管或数据库管理员执行）
CREATE OR REPLACE FUNCTION public.set_super_admin(p_user_id UUID, p_is_super_admin BOOLEAN)
RETURNS BOOLEAN AS $$
DECLARE
  current_admin_id UUID;
  current_is_super_admin BOOLEAN;
BEGIN
  -- 检查当前用户是否为超管
  current_admin_id := auth.uid();
  SELECT COALESCE(is_super_admin, FALSE) INTO current_is_super_admin
  FROM public.admins
  WHERE user_id = current_admin_id;

  -- 只有超管可以设置其他用户的超管状态
  -- 如果没有超管，允许首次设置（用于初始化）
  IF current_is_super_admin = FALSE THEN
    -- 检查是否已有超管
    IF EXISTS (SELECT 1 FROM public.admins WHERE COALESCE(is_super_admin, FALSE) = TRUE) THEN
      RAISE EXCEPTION 'Only super admin can set super admin status';
    END IF;
  END IF;

  -- 检查目标用户是否存在
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User does not exist';
  END IF;

  -- 确保用户是管理员
  IF NOT EXISTS (SELECT 1 FROM public.admins WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION 'User must be an admin first';
  END IF;

  -- 更新超管状态
  UPDATE public.admins
  SET is_super_admin = p_is_super_admin
  WHERE user_id = p_user_id;

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to set super admin: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 更新 get_users_with_admin_status 函数，包含超管状态
-- 注意：由于返回类型改变（添加了 is_super_admin 列），需要先删除旧函数
DROP FUNCTION IF EXISTS public.get_users_with_admin_status(INTEGER, INTEGER);

CREATE FUNCTION public.get_users_with_admin_status(
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  id UUID,
  user_email TEXT,
  username TEXT,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  is_admin BOOLEAN,
  is_super_admin BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    COALESCE(au.email::TEXT, 'N/A') as user_email,
    p.username,
    p.full_name,
    p.created_at,
    EXISTS(SELECT 1 FROM public.admins a1 WHERE a1.user_id = p.id) as is_admin,
    EXISTS(SELECT 1 FROM public.admins a2 WHERE a2.user_id = p.id AND COALESCE(a2.is_super_admin, FALSE) = TRUE) as is_super_admin
  FROM public.profiles p
  LEFT JOIN auth.users au ON p.id = au.id
  ORDER BY p.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 授予执行权限
GRANT EXECUTE ON FUNCTION public.is_super_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_super_admin(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_users_with_admin_status(INTEGER, INTEGER) TO authenticated;

-- ============================================
-- 完成
-- ============================================
-- 现在可以执行 supabase-set-super-admin.sql 来设置超管

