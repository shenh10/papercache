-- Supabase数据库函数
-- 用于自动创建用户档案和记录登录日志

-- ============================================
-- 自动创建用户档案函数（已废弃）
-- ============================================
-- 注意：此函数已不再使用。Profile应该在首次登录时由前端代码创建，而不是注册时。
-- 原因：
-- 1. 用户注册后可能不验证邮箱，不需要profile
-- 2. OAuth登录时没有"注册"步骤，触发器不会触发
-- 3. 只有真实登录的用户才需要profile，避免创建"僵尸"数据
--
-- 如果仍需要数据库触发器，可以保留此函数，但前端代码会在首次登录时创建profile作为主要方式。

-- 创建profile的函数（供前端调用或作为触发器使用）
CREATE OR REPLACE FUNCTION public.create_user_profile_if_not_exists(
  p_user_id UUID,
  p_username TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL,
  p_full_name TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_username TEXT;
BEGIN
  -- 检查profile是否已存在
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RETURN; -- 已存在，不重复创建
  END IF;
  
  -- 如果没有提供username，从email提取
  v_username := COALESCE(
    p_username,
    (SELECT split_part(email, '@', 1) FROM auth.users WHERE id = p_user_id LIMIT 1),
    'user'
  );
  
  -- 创建profile
  INSERT INTO public.profiles (id, username, avatar_url, full_name)
  VALUES (p_user_id, v_username, p_avatar_url, p_full_name)
  ON CONFLICT (id) DO NOTHING;
  
EXCEPTION
  WHEN OTHERS THEN
    -- 记录错误但不抛出异常
    RAISE WARNING 'Failed to create profile for user %: %', p_user_id, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 可选：如果仍需要在注册时创建profile，取消下面的注释
-- 但建议使用前端首次登录时创建的方式，更灵活
/*
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_username TEXT;
BEGIN
  -- 从 metadata 获取 username，如果没有则从 email 提取
  v_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    CASE 
      WHEN NEW.email IS NOT NULL THEN split_part(NEW.email, '@', 1)
      ELSE 'user'
    END
  );
  
  INSERT INTO public.profiles (id, username, avatar_url, full_name)
  VALUES (
    NEW.id,
    v_username,
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'full_name'
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- 如果插入失败，记录错误但不阻止用户创建
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建触发器（如果需要在注册时创建profile）
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
*/

-- ============================================
-- 记录登录日志函数
-- ============================================

-- 函数：记录用户登录
CREATE OR REPLACE FUNCTION public.log_user_login(
  p_user_id UUID,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.login_logs (user_id, ip_address, user_agent)
  VALUES (p_user_id, p_ip_address, p_user_agent)
  RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 获取登录日志（带用户邮箱）
-- ============================================

-- 函数：获取登录日志列表，包含用户邮箱
-- 用于管理后台显示登录记录
CREATE OR REPLACE FUNCTION public.get_login_logs_with_email(
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_user_email TEXT DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  user_id UUID,
  user_email TEXT,
  login_at TIMESTAMP WITH TIME ZONE,
  ip_address INET,
  user_agent TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ll.id,
    ll.user_id,
    COALESCE(au.email::TEXT, 'N/A') as user_email,
    ll.login_at,
    ll.ip_address,
    ll.user_agent
  FROM public.login_logs ll
  LEFT JOIN auth.users au ON ll.user_id = au.id
  WHERE 
    (p_start_date IS NULL OR DATE(ll.login_at) >= p_start_date)
    AND (p_end_date IS NULL OR DATE(ll.login_at) <= p_end_date)
    AND (p_user_email IS NULL OR p_user_email = '' OR au.email::TEXT ILIKE '%' || p_user_email || '%')
  ORDER BY ll.login_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 函数：获取登录日志总数（用于分页）
CREATE OR REPLACE FUNCTION public.get_login_logs_count(
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_user_email TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  count_result INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER
  INTO count_result
  FROM public.login_logs ll
  LEFT JOIN auth.users au ON ll.user_id = au.id
  WHERE 
    (p_start_date IS NULL OR DATE(ll.login_at) >= p_start_date)
    AND (p_end_date IS NULL OR DATE(ll.login_at) <= p_end_date)
    AND (p_user_email IS NULL OR p_user_email = '' OR au.email::TEXT ILIKE '%' || p_user_email || '%');
  
  RETURN COALESCE(count_result, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 授予函数执行权限
GRANT EXECUTE ON FUNCTION public.get_login_logs_count(DATE, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_login_logs_with_email(INTEGER, INTEGER, DATE, DATE, TEXT) TO authenticated;

-- ============================================
-- 获取用户列表（带用户邮箱）
-- ============================================

-- 函数：获取用户列表，包含用户邮箱
-- 用于管理后台显示用户信息
CREATE OR REPLACE FUNCTION public.get_users_with_email(
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  id UUID,
  user_email TEXT,
  username TEXT,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    COALESCE(au.email::TEXT, 'N/A') as user_email,
    p.username,
    p.full_name,
    p.created_at,
    p.updated_at
  FROM public.profiles p
  LEFT JOIN auth.users au ON p.id = au.id
  ORDER BY p.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 授予函数执行权限
GRANT EXECUTE ON FUNCTION public.get_users_with_email(INTEGER, INTEGER) TO authenticated;

-- 函数：获取用户总数（用于分页）
CREATE OR REPLACE FUNCTION public.get_users_count()
RETURNS INTEGER AS $$
DECLARE
  count_result INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER
  INTO count_result
  FROM public.profiles;
  
  RETURN COALESCE(count_result, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 授予函数执行权限
GRANT EXECUTE ON FUNCTION public.get_users_count() TO authenticated;

-- ============================================
-- 获取总登录记录数
-- ============================================

-- 函数：获取所有用户的总登录记录数，绕过 RLS 策略限制
-- 用于管理员页面显示统计信息
CREATE OR REPLACE FUNCTION public.get_total_login_logs_count()
RETURNS INTEGER AS $$
DECLARE
  count_result INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER
  INTO count_result
  FROM public.login_logs;
  
  RETURN COALESCE(count_result, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 给函数添加注释
COMMENT ON FUNCTION public.get_total_login_logs_count() IS 
'获取所有用户的总登录记录数，绕过RLS策略限制。用于管理员页面统计。返回：总登录记录数（整数）';

-- 授予函数执行权限
GRANT EXECUTE ON FUNCTION public.get_total_login_logs_count() TO authenticated;

-- ============================================
-- 获取收藏统计函数
-- ============================================

-- 函数：获取某个文章的收藏数
CREATE OR REPLACE FUNCTION public.get_post_favorite_count(p_post_url TEXT)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM favorites
    WHERE post_url = p_post_url
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 函数：检查用户是否收藏了某篇文章
CREATE OR REPLACE FUNCTION public.is_post_favorited(
  p_user_id UUID,
  p_post_url TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM favorites
    WHERE user_id = p_user_id AND post_url = p_post_url
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 管理员管理
-- ============================================

-- 创建管理员表（如果不存在）
CREATE TABLE IF NOT EXISTS public.admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(user_id)
);

-- 启用Row Level Security
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- 管理员表的RLS策略：只有管理员可以查看和管理
DROP POLICY IF EXISTS "Admins can view all admins" ON public.admins;
CREATE POLICY "Admins can view all admins"
  ON public.admins FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admins 
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can insert admins" ON public.admins;
CREATE POLICY "Admins can insert admins"
  ON public.admins FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admins 
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can delete admins" ON public.admins;
CREATE POLICY "Admins can delete admins"
  ON public.admins FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.admins 
      WHERE user_id = auth.uid()
    )
  );

-- 更新 is_admin() 函数，从管理员表读取
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  IF check_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- 从管理员表检查
  RETURN EXISTS (
    SELECT 1 FROM public.admins 
    WHERE admins.user_id = check_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 函数：添加管理员
CREATE OR REPLACE FUNCTION public.add_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  current_admin_id UUID;
BEGIN
  -- 检查当前用户是否为管理员
  current_admin_id := auth.uid();
  IF NOT EXISTS (SELECT 1 FROM public.admins WHERE user_id = current_admin_id) THEN
    RAISE EXCEPTION 'Only admins can add other admins';
  END IF;

  -- 检查目标用户是否存在
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User does not exist';
  END IF;

  -- 插入管理员记录（如果不存在）
  INSERT INTO public.admins (user_id, created_by)
  VALUES (p_user_id, current_admin_id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to add admin: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 函数：移除管理员
CREATE OR REPLACE FUNCTION public.remove_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  current_admin_id UUID;
  admin_count INTEGER;
BEGIN
  -- 检查当前用户是否为管理员
  current_admin_id := auth.uid();
  IF NOT EXISTS (SELECT 1 FROM public.admins WHERE user_id = current_admin_id) THEN
    RAISE EXCEPTION 'Only admins can remove other admins';
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

-- 函数：检查用户是否为管理员
CREATE OR REPLACE FUNCTION public.check_user_is_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admins 
    WHERE user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 函数：获取用户列表（包含管理员状态）
CREATE OR REPLACE FUNCTION public.get_users_with_admin_status(
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  id UUID,
  user_email TEXT,
  username TEXT,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  is_admin BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    COALESCE(au.email::TEXT, 'N/A') as user_email,
    p.username,
    p.full_name,
    p.created_at,
    EXISTS(SELECT 1 FROM public.admins WHERE user_id = p.id) as is_admin
  FROM public.profiles p
  LEFT JOIN auth.users au ON p.id = au.id
  ORDER BY p.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 函数：删除用户（级联删除所有相关数据）
-- 注意：此函数只删除公共表的数据，auth.users需要通过Admin API删除
CREATE OR REPLACE FUNCTION public.delete_user_data(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  current_admin_id UUID;
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

-- 授予函数执行权限
GRANT EXECUTE ON FUNCTION public.add_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_user_is_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_users_with_admin_status(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_data(UUID) TO authenticated;

-- ============================================
-- 初始化管理员（重要！）
-- ============================================
-- 首次部署后，需要手动插入第一个管理员
-- 替换 YOUR_ADMIN_USER_ID 为实际的管理员用户ID（从auth.users表获取）
--
-- 示例：
-- INSERT INTO public.admins (user_id, created_by)
-- VALUES ('YOUR_ADMIN_USER_ID', 'YOUR_ADMIN_USER_ID')
-- ON CONFLICT (user_id) DO NOTHING;
--
-- 或者通过邮箱查找用户ID：
-- INSERT INTO public.admins (user_id, created_by)
-- SELECT id, id FROM auth.users WHERE email = 'admin@example.com'
-- ON CONFLICT (user_id) DO NOTHING;

