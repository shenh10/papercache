-- ============================================
-- 诊断收藏查询性能问题
-- ============================================
-- 在Supabase Dashboard的SQL Editor中执行此文件
-- 
-- 用途：检查索引是否被正确使用，查询计划是否优化

-- 1. 检查索引是否存在
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'favorites'
ORDER BY indexname;

-- 2. 更新表统计信息（重要：让PostgreSQL重新分析表，优化查询计划）
ANALYZE favorites;

-- 3. 查看表的基本统计信息
SELECT 
  schemaname,
  relname as tablename,
  n_live_tup as row_count,
  n_dead_tup as dead_rows,
  last_vacuum,
  last_autovacuum,
  last_analyze,
  last_autoanalyze
FROM pg_stat_user_tables
WHERE relname = 'favorites';

-- 4. 检查索引使用情况
SELECT 
  schemaname,
  relname as tablename,
  indexrelname as indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched,
  CASE 
    WHEN idx_scan = 0 THEN '⚠️ 索引未被使用'
    WHEN idx_scan < 10 THEN '⚠️ 索引使用较少'
    ELSE '✅ 索引正常使用'
  END as usage_status
FROM pg_stat_user_indexes
WHERE relname = 'favorites'
ORDER BY idx_scan DESC;

-- 5. 查看查询计划（需要替换 YOUR_USER_ID 为实际用户ID）
-- 注意：这个查询需要在实际用户上下文中执行，所以可能需要通过应用层执行
-- 或者使用 EXPLAIN ANALYZE 在 Supabase Dashboard 中测试
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT id, post_url, created_at, is_read, read_at
FROM favorites
WHERE user_id = '00000000-0000-0000-0000-000000000000'  -- 替换为实际用户ID
ORDER BY created_at DESC;

-- 6. 检查索引大小
SELECT 
  indexname,
  pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
FROM pg_indexes
WHERE tablename = 'favorites'
ORDER BY pg_relation_size(indexname::regclass) DESC;

-- 7. 检查是否有重复或冗余的索引
SELECT 
  a.indexname as index_a,
  b.indexname as index_b,
  a.indexdef as def_a,
  b.indexdef as def_b
FROM pg_indexes a
JOIN pg_indexes b ON a.tablename = b.tablename
WHERE a.tablename = 'favorites'
  AND a.indexname < b.indexname
  AND (
    -- 检查是否有包含关系的索引
    a.indexdef LIKE '%' || b.indexdef || '%'
    OR b.indexdef LIKE '%' || a.indexdef || '%'
  );

-- ============================================
-- 如果索引未被使用，可能的原因和解决方案：
-- ============================================
-- 1. 表统计信息过期：执行 ANALYZE favorites;
-- 2. 数据量太小：PostgreSQL可能选择全表扫描（如果只有几条记录）
-- 3. 索引定义不正确：检查索引列的顺序和排序方向
-- 4. 查询条件不匹配：确保查询使用了索引的第一列（user_id）

-- ============================================
-- 强制使用索引的查询（如果PostgreSQL没有自动选择）
-- ============================================
-- 注意：通常不需要强制使用索引，但如果确实需要，可以使用：
-- SET enable_seqscan = off;  -- 临时禁用顺序扫描（仅用于测试）
-- 然后执行查询，查看性能
-- SET enable_seqscan = on;   -- 恢复默认设置

