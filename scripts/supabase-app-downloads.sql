-- ============================================
-- App 下载量统计（在 Supabase Dashboard SQL Editor 执行一次）
-- 埋点：网站「App」页下载按钮（source=site）/ App 内检查更新下载（source=update）
-- 匿名可插入（埋点不要求登录），仅管理员可查询
-- ============================================

CREATE TABLE IF NOT EXISTS public.app_downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL DEFAULT 'site',      -- site | update
  from_build INT,                            -- App 内更新时的旧 build 号
  target_build INT,                          -- 要下载的 build 号
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.app_downloads ENABLE ROW LEVEL SECURITY;

-- 匿名可写入埋点（和 post_clicks 一样接受匿名写入）
DROP POLICY IF EXISTS "Anyone can log app download" ON public.app_downloads;
CREATE POLICY "Anyone can log app download" ON public.app_downloads
  FOR INSERT WITH CHECK (true);

-- 仅管理员可读
DROP POLICY IF EXISTS "Admins can view app downloads" ON public.app_downloads;
CREATE POLICY "Admins can view app downloads" ON public.app_downloads
  FOR SELECT TO authenticated
  USING (is_admin());

CREATE INDEX IF NOT EXISTS idx_app_downloads_created ON public.app_downloads (created_at DESC);
