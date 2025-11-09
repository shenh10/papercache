# Supabase 搜索性能优化指南

## 问题分析

Supabase 搜索比 Vercel API 慢的主要原因：

1. **LIKE '%query%' 无法使用索引**
   - 当前的 `search_posts_fuzzy` 函数使用 `LIKE '%query%'` 模式
   - 这种模式会导致全表扫描，性能很差
   - Vercel API 可能使用内存索引（如 Lunr.js），速度很快

2. **缺少文本搜索索引**
   - 虽然有 `search_vector` 索引，但模糊搜索不使用它
   - 需要专门的文本搜索索引来加速 LIKE 查询

3. **网络延迟**
   - Supabase 数据库查询需要网络往返
   - Vercel Functions 可能在同一区域，延迟更低

## 优化方案

### 步骤 1: 执行优化 SQL

在 Supabase Dashboard 的 SQL Editor 中执行：

```bash
# 执行优化脚本
scripts/supabase-posts-search-optimized.sql
```

这会：
- 启用 `pg_trgm` 扩展（用于相似度搜索）
- 创建 GIN 索引（加速文本搜索）
- 创建优化后的搜索函数 `search_posts_fuzzy_optimized`

### 步骤 2: 验证优化

1. 刷新页面
2. 执行搜索，查看控制台日志：
   ```
   [supabase-search] 搜索耗时: XX.XXms
   ```
3. 对比优化前后的耗时

### 步骤 3: 性能对比

优化前（使用 `search_posts_fuzzy`）：
- 查询时间：500-2000ms（取决于数据量）
- 使用全表扫描

优化后（使用 `search_posts_fuzzy_optimized`）：
- 查询时间：50-300ms（使用索引）
- 使用 GIN 索引加速

## 优化原理

### 1. pg_trgm 扩展

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

- 提供 `similarity()` 函数进行相似度搜索
- 支持 GIN 索引用于文本搜索

### 2. GIN 索引

```sql
CREATE INDEX idx_posts_search_title_gin_trgm 
ON posts_search USING GIN(title gin_trgm_ops);
```

- 加速 `LIKE '%query%'` 查询
- 加速相似度搜索
- 索引大小会增加，但查询速度显著提升

### 3. 优化查询策略

优化后的函数：
1. **优先使用索引友好的查询**：`LIKE 'query%'`（开头匹配）
2. **使用相似度搜索**：`similarity()` 函数（可以利用索引）
3. **最后才使用全匹配**：`LIKE '%query%'`（作为降级方案）

## 性能监控

前端代码已添加性能监控，控制台会显示：
- `[supabase-search] 搜索耗时: XX.XXms`

如果看到耗时 > 500ms，可能需要：
1. 检查索引是否创建成功
2. 检查数据量是否过大
3. 考虑使用全文搜索（`search_posts_fulltext`）替代模糊搜索

## 回退机制

如果优化函数不存在，代码会自动回退到原函数：
- 检查错误代码 `42883`（函数不存在）
- 自动使用 `search_posts_fuzzy`
- 记录回退日志

## 进一步优化建议

如果性能仍然不理想，可以考虑：

1. **使用全文搜索**（英文内容）
   ```javascript
   searchOptions.matchMode = 'fulltext';
   ```

2. **限制搜索范围**
   - 使用 tag 过滤减少搜索数据量
   - 使用 categories 过滤

3. **添加缓存**
   - 对常见查询结果进行缓存
   - 使用 localStorage 或内存缓存

4. **考虑使用 Vercel Edge Functions**
   - 如果 Supabase 延迟仍然较高
   - 可以在 Vercel Edge 上部署搜索 API

## 预期效果

- **优化前**：500-2000ms
- **优化后**：50-300ms
- **接近 Vercel API**：如果网络延迟低，可以达到 100-200ms


