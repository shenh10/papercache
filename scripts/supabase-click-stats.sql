-- 创建文章点击统计表
-- 在Supabase Dashboard的SQL Editor中执行

-- 创建点击统计表
CREATE TABLE IF NOT EXISTS post_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_url TEXT NOT NULL,
  click_count INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(post_url)
);

-- 启用Row Level Security
ALTER TABLE post_clicks ENABLE ROW LEVEL SECURITY;

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_post_clicks_post_url ON post_clicks(post_url);
CREATE INDEX IF NOT EXISTS idx_post_clicks_click_count ON post_clicks(click_count DESC);
CREATE INDEX IF NOT EXISTS idx_post_clicks_updated_at ON post_clicks(updated_at DESC);

-- 创建更新时间触发器
CREATE TRIGGER update_post_clicks_updated_at
  BEFORE UPDATE ON post_clicks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS策略：所有人都可以读取和增加点击量（匿名用户也可以）
DROP POLICY IF EXISTS "Anyone can view click stats" ON post_clicks;
CREATE POLICY "Anyone can view click stats"
  ON post_clicks FOR SELECT
  USING (true);

-- 使用PostgreSQL函数来原子性地增加点击量（避免并发问题）
CREATE OR REPLACE FUNCTION increment_post_click(p_url TEXT)
RETURNS INTEGER AS $$
DECLARE
  new_count INTEGER;
BEGIN
  INSERT INTO post_clicks (post_url, click_count)
  VALUES (p_url, 1)
  ON CONFLICT (post_url) 
  DO UPDATE SET 
    click_count = post_clicks.click_count + 1,
    updated_at = NOW()
  RETURNING click_count INTO new_count;
  
  RETURN new_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS策略：所有人都可以增加点击量（通过函数）
DROP POLICY IF EXISTS "Anyone can increment clicks" ON post_clicks;
CREATE POLICY "Anyone can increment clicks"
  ON post_clicks FOR UPDATE
  USING (true)
  WITH CHECK (true);

