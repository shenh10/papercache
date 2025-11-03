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

