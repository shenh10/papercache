-- ============================================
-- 更新删除用户函数，添加超管保护
-- ============================================
-- 此脚本更新 delete_user_data 函数，添加超管保护机制
-- 只有超管可以删除用户，且不能删除超管
-- ============================================

CREATE OR REPLACE FUNCTION public.delete_user_data(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  current_admin_id UUID;
  target_is_super_admin BOOLEAN;
  current_is_super_admin BOOLEAN;
BEGIN
  -- 检查当前用户是否为管理员
  current_admin_id := auth.uid();
  IF NOT EXISTS (SELECT 1 FROM public.admins WHERE user_id = current_admin_id) THEN
    RAISE EXCEPTION 'Only admins can delete users';
  END IF;

  -- 不能删除自己
  IF p_user_id = current_admin_id THEN
    RAISE EXCEPTION 'Cannot delete yourself';
  END IF;

  -- 检查目标用户是否为超管
  SELECT COALESCE(is_super_admin, FALSE) INTO target_is_super_admin
  FROM public.admins
  WHERE user_id = p_user_id;

  -- 检查当前用户是否为超管
  SELECT COALESCE(is_super_admin, FALSE) INTO current_is_super_admin
  FROM public.admins
  WHERE user_id = current_admin_id;

  -- 超管不能被删除
  IF target_is_super_admin = TRUE THEN
    RAISE EXCEPTION 'Cannot delete super admin';
  END IF;

  -- 只有超管可以删除其他用户（普通管理员不能删除用户）
  IF current_is_super_admin = FALSE THEN
    RAISE EXCEPTION 'Only super admin can delete users';
  END IF;

  -- 检查目标用户是否存在
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User does not exist';
  END IF;

  -- 删除用户相关的所有数据（级联删除会自动处理profiles、favorites、login_logs等）
  -- 先从admins表中删除（如果存在）
  DELETE FROM public.admins WHERE user_id = p_user_id;
  
  -- 删除profiles（这会触发级联删除favorites、login_logs等）
  DELETE FROM public.profiles WHERE id = p_user_id;

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to delete user data: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 完成
-- ============================================
-- 现在只有超管可以删除用户，且不能删除超管

