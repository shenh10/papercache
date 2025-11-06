# Supabase 搜索功能迁移指南

## 概述

本指南将帮助你从 Vercel + Lunr.js 搜索迁移到 Supabase 全文搜索。

## 迁移步骤

### 步骤 1: 创建数据库表

在 Supabase Dashboard 的 SQL Editor 中执行：

```bash
# 执行表结构创建脚本
scripts/supabase-posts-search.sql
```

这将创建：
- `posts_search` 表
- 全文搜索索引
- 搜索 RPC 函数
- 触发器（自动更新 search_vector）

### 步骤 2: 同步论文数据

运行数据同步脚本：

```bash
# 设置环境变量
export SUPABASE_URL="your_supabase_url"
export SUPABASE_SERVICE_KEY="your_service_key"

# 运行同步脚本
python3 scripts/sync_posts_to_search.py
```

脚本会：
- 从 `_data/collection_structure.yml` 读取论文数据
- 从 `assets/data/excerpts.json` 读取摘要
- 同步到 Supabase `posts_search` 表

### 步骤 3: 验证搜索功能

1. 刷新页面
2. 在搜索框输入关键词
3. 查看浏览器控制台日志：
   - `[supabase-search] ✅ Supabase 搜索服务已初始化`
   - `[search-first] 尝试使用 Supabase 搜索`
   - `[search-first] Supabase 搜索成功，找到 X 篇论文`

### 步骤 4: 测试搜索质量

对比搜索结果：
- Supabase 搜索（优先）
- Vercel API 搜索（降级）
- 本地搜索（最终降级）

## 搜索优先级

当前的搜索优先级（失败时自动降级）：

1. **Supabase 搜索**（优先）
   - 使用 `search_posts_fuzzy` 函数
   - 支持中文搜索
   - 支持 tag 过滤

2. **Vercel API 搜索**（降级1）
   - 使用 Lunr.js
   - 支持精确/模糊匹配
   - 支持多字段搜索

3. **本地搜索**（降级2）
   - 在已加载的论文数据中搜索
   - 支持基本匹配

## 功能对比

| 功能 | Supabase | Vercel API | 本地搜索 |
|------|----------|------------|----------|
| 中文搜索 | ✅ | ⚠️ 有限 | ✅ |
| 权重排序 | ✅ | ✅ | ❌ |
| Tag 过滤 | ✅ | ✅ | ✅ |
| 分类过滤 | ⚠️ 待实现 | ✅ | ✅ |
| 实时更新 | ✅ | ❌ | ❌ |
| 性能 | ⚠️ 需测试 | ✅ | ✅ |

## 注意事项

1. **中文搜索限制**
   - PostgreSQL 默认不支持中文分词
   - 当前使用 `LIKE` 匹配（简单但有效）
   - 如需更好支持，可配置 `pg_trgm` 扩展

2. **数据同步**
   - 添加新论文后需要运行同步脚本
   - 可以配置 CI/CD 自动同步

3. **性能监控**
   - 监控 Supabase 查询次数
   - 免费版限制：50,000 MAU

4. **降级机制**
   - 如果 Supabase 搜索失败，自动降级到 Vercel API
   - 如果 Vercel API 也失败，降级到本地搜索

## 故障排查

### 问题：搜索无结果

1. 检查数据是否已同步：
   ```sql
   SELECT COUNT(*) FROM posts_search;
   ```

2. 检查搜索函数是否可用：
   ```sql
   SELECT search_posts_fuzzy('test', NULL, NULL, 10);
   ```

3. 查看浏览器控制台错误信息

### 问题：搜索速度慢

1. 检查索引是否创建：
   ```sql
   \d posts_search
   ```
   应该看到 `idx_posts_search_vector` 索引

2. 检查数据量：
   ```sql
   SELECT COUNT(*) FROM posts_search;
   ```

3. 考虑使用 `search_posts_fulltext`（英文搜索更快）

## 后续优化

1. 配置中文分词（pg_trgm 或 zhparser）
2. 添加分类过滤支持
3. 优化搜索相关性排序
4. 添加搜索建议/自动完成
5. 实现搜索历史记录

## 回滚方案

如果 Supabase 搜索有问题，可以：

1. 注释掉 Supabase 搜索代码（保留 Vercel API 和本地搜索）
2. 或者设置环境变量禁用 Supabase 搜索

