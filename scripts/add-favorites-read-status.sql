-- ============================================
-- 为收藏表添加已读状态字段
-- ============================================
-- 在Supabase Dashboard的SQL Editor中执行此文件

-- 添加is_read字段（布尔类型，默认为false）
ALTER TABLE favorites 
ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;

-- 添加read_at字段（可选，记录标记为已读的时间）
ALTER TABLE favorites 
ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE;

-- 为is_read字段创建索引，提高查询性能
CREATE INDEX IF NOT EXISTS idx_favorites_is_read ON favorites(user_id, is_read);

-- 添加注释
COMMENT ON COLUMN favorites.is_read IS '标记论文是否已读，默认false（未读）';
COMMENT ON COLUMN favorites.read_at IS '标记为已读的时间戳';


