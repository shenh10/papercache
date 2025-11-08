-- ============================================
-- 优化收藏表查询性能
-- ============================================
-- 在Supabase Dashboard的SQL Editor中执行此文件
-- 
-- 问题：getUserFavorites 查询按 user_id 过滤并按 created_at 排序，
--       但只有单独的索引，没有复合索引，导致查询性能低下
-- 解决：添加复合索引 (user_id, created_at DESC) 以优化查询性能

-- 删除旧的单独索引（如果存在且不再需要）
-- 注意：保留 idx_favorites_user_id，因为其他地方可能用到
-- DROP INDEX IF EXISTS idx_favorites_user_id; -- 不删除，保留兼容性

-- 添加复合索引，优化按用户ID查询并按创建时间排序的查询
-- 这个索引可以同时满足 WHERE user_id = ? 和 ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_favorites_user_created_at 
ON favorites(user_id, created_at DESC);

-- 如果查询也按 is_read 过滤，可以添加包含 is_read 的复合索引
-- 这样可以优化"获取未读收藏"或"获取已读收藏"的查询
CREATE INDEX IF NOT EXISTS idx_favorites_user_read_created 
ON favorites(user_id, is_read, created_at DESC);

-- 添加注释
COMMENT ON INDEX idx_favorites_user_created_at IS 
'复合索引：优化按用户ID查询并按创建时间排序的查询性能';

COMMENT ON INDEX idx_favorites_user_read_created IS 
'复合索引：优化按用户ID和已读状态查询并按创建时间排序的查询性能';

-- ============================================
-- 验证索引是否创建成功
-- ============================================
-- 执行以下查询来验证索引是否已创建：

-- 1. 检查索引是否存在
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'favorites'
  AND indexname IN ('idx_favorites_user_created_at', 'idx_favorites_user_read_created')
ORDER BY indexname;

-- 预期结果：应该返回 2 行，显示两个新创建的索引

-- 2. 查看所有 favorites 表的索引（包括新创建的）
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'favorites'
ORDER BY indexname;

-- 预期结果：应该包含以下索引：
-- - idx_favorites_user_id (原有)
-- - idx_favorites_post_url (原有)
-- - idx_favorites_user_created_at (新创建) ✅
-- - idx_favorites_user_read_created (新创建) ✅
-- - idx_favorites_is_read (如果存在)

-- 3. 测试查询性能（可选）
-- 执行后，刷新"我的收藏"页面，查看控制台日志
-- 查询时间应该从 1-2.5秒 降低到 50-200ms

