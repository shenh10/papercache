-- ============================================
-- 演示文稿服务端保护（在 Supabase Dashboard SQL Editor 执行一次）
-- 元数据表 + 私有存储桶，RLS 仅允许管理员读取；
-- CI 用 service_role 写入（service_role 绕过 RLS）
-- ============================================

-- 1) 元数据表
CREATE TABLE IF NOT EXISTS public.slides_search (
  post_url TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  excerpt TEXT,
  categories TEXT[],
  tag TEXT,
  published_date TEXT,
  content_md5 TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.slides_search ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view slides" ON public.slides_search;
CREATE POLICY "Admins can view slides" ON public.slides_search
  FOR SELECT TO authenticated
  USING (is_admin());

-- 2) 私有存储桶（存每篇 slides 的完整 HTML，对象路径 = post_url 去掉开头的 /slides/）
INSERT INTO storage.buckets (id, name, public)
VALUES ('slides', 'slides', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Admins can read slide content" ON storage.objects;
CREATE POLICY "Admins can read slide content" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'slides' AND is_admin());

-- 验证：
-- SELECT * FROM storage.buckets WHERE id = 'slides';           -- public 应为 false
-- SELECT count(*) FROM pg_policies WHERE tablename IN ('slides_search', 'objects')
--   AND policyname LIKE '%slides%';



