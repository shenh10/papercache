# Supabase 搜索功能快速设置指南

## 问题诊断

如果你看到以下错误：
```
Could not find the function public.search_posts_fuzzy(...) in the schema cache
```

说明数据库中还**没有创建搜索函数**，需要执行 SQL 脚本。

## 快速设置步骤

### 步骤 1: 在 Supabase Dashboard 执行 SQL

1. 打开 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择你的项目
3. 点击左侧菜单的 **SQL Editor**
4. 点击 **New Query**
5. 复制并粘贴 `scripts/supabase-posts-search.sql` 文件的**全部内容**
6. 点击 **Run** 或按 `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)

### 验证 SQL 执行成功

执行后，你应该看到类似这样的输出：
```
Success. No rows returned
```

### 验证函数是否创建成功

在 SQL Editor 中运行以下查询验证：

```sql
-- 检查函数是否存在
SELECT 
  routine_name, 
  routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name LIKE 'search_posts%';
```

应该返回：
- `search_posts_fulltext`
- `search_posts_fuzzy`
- `upsert_post_search`

### 验证表是否存在

```sql
-- 检查表是否存在
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'posts_search';
```

应该返回 `posts_search`。

## 步骤 2: 同步论文数据

执行 SQL 后，需要同步论文数据到 `posts_search` 表：

```bash
# 设置环境变量
export SUPABASE_URL="your_supabase_url"
export SUPABASE_SERVICE_KEY="your_service_key"

# 运行同步脚本
cd papercache
python3 scripts/sync_posts_to_search.py
```

### 验证数据是否同步成功

在 SQL Editor 中运行：

```sql
-- 检查数据数量
SELECT COUNT(*) FROM posts_search;
```

应该有数据返回（数量取决于你的论文数量）。

## 步骤 3: 测试搜索功能

刷新页面后，在搜索框输入关键词测试。如果一切正常，你应该看到：

```
[supabase-search] ✅ Supabase 搜索服务已初始化
[search-first] 尝试使用 Supabase 搜索
[supabase-search] 搜索请求: { query: "...", functionName: "search_posts_fuzzy", ... }
[supabase-search] 搜索结果数量: X
[search-first] Supabase 搜索成功，找到 X 篇论文
```

## 常见问题

### 问题 1: 函数不存在

**错误**: `Could not find the function public.search_posts_fuzzy`

**解决**: 
- 确认已在 Supabase Dashboard 的 SQL Editor 中执行了 `supabase-posts-search.sql`
- 检查是否有 SQL 语法错误
- 确认使用的是正确的数据库（不是其他项目的数据库）

### 问题 2: 表不存在

**错误**: `relation "posts_search" does not exist`

**解决**: 
- 确认 SQL 脚本已完整执行
- 检查 `CREATE TABLE posts_search` 语句是否执行成功

### 问题 3: 没有搜索结果

**可能原因**:
1. 数据未同步（`posts_search` 表为空）
2. 搜索关键词不匹配

**解决**:
- 运行 `sync_posts_to_search.py` 同步数据
- 检查 `posts_search` 表中是否有数据：`SELECT COUNT(*) FROM posts_search;`

### 问题 4: 权限错误

**错误**: `permission denied for table posts_search`

**解决**:
- 确认 RLS 策略已创建：检查 `scripts/supabase-posts-search.sql` 中的 `CREATE POLICY` 语句
- 在 Supabase Dashboard 的 **Authentication** → **Policies** 中检查 `posts_search` 表的策略

## 快速测试 SQL

如果你想快速测试搜索函数是否工作，可以在 SQL Editor 中运行：

```sql
-- 测试模糊搜索
SELECT * FROM search_posts_fuzzy('test', NULL, NULL, 10);
```

如果有数据，应该返回结果。如果没有数据，先运行同步脚本。


