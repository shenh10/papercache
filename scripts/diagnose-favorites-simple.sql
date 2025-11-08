-- ============================================
-- 诊断收藏查询性能问题（简化版 - 分步执行）
-- ============================================
-- 建议：每次只执行一个查询，查看结果后再执行下一个

-- ============================================
-- 步骤 1: 更新表统计信息（最重要！先执行这个）
-- ============================================
ANALYZE favorites;

-- ============================================
-- 步骤 2: 检查索引是否存在
-- ============================================
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'favorites'
ORDER BY indexname;

-- ============================================
-- 步骤 3: 检查索引使用情况
-- ============================================
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

-- ============================================
-- 步骤 4: 查看表的基本统计信息
-- ============================================
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

-- ============================================
-- 步骤 5: 检查索引大小
-- ============================================
SELECT 
  indexname,
  pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
FROM pg_indexes
WHERE tablename = 'favorites'
ORDER BY pg_relation_size(indexname::regclass) DESC;

