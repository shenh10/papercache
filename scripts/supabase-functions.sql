-- Supabase数据库函数
-- 用于自动创建用户档案和记录登录日志

-- ============================================
-- 自动创建用户档案函数
-- ============================================

-- 当新用户注册时，自动创建对应的profile记录
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

-- 创建触发器
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

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

