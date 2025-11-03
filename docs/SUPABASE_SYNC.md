# Supabase 与论文文章同步指南

## 📋 概述

当你在 Git 中增删论文文章时，需要保持 Supabase 数据库的一致性。本文档说明如何自动清理无效记录。

## 🔍 问题背景

Supabase 中存储的数据：
- **`favorites` 表**：用户收藏记录（`post_url` 字段）
- **`post_clicks` 表**：文章点击统计（`post_url` 字段）

**问题：**
- 当你删除文章时，Supabase 中可能仍存在指向该文章的收藏和点击统计记录
- 这些"孤儿记录"会导致：
  - 数据库膨胀
  - 查询性能下降
  - 用户看到无效的收藏项

## ✅ 解决方案

### 1. Supabase SQL 函数

**文件：** `scripts/supabase-cleanup-orphan-records.sql`

提供了三个清理函数：
- `cleanup_invalid_favorites(p_valid_urls TEXT[])` - 清理无效收藏
- `cleanup_invalid_click_stats(p_valid_urls TEXT[])` - 清理无效点击统计
- `cleanup_all_invalid_records(p_valid_urls TEXT[])` - 批量清理（推荐）

**部署方法：**
```sql
-- 在 Supabase Dashboard → SQL Editor 中执行
-- 复制 scripts/supabase-cleanup-orphan-records.sql 的内容并执行
```

### 2. 同步脚本

**文件：** `scripts/sync_supabase_with_posts.py`

**功能：**
- 扫描 `_posts/` 目录，获取所有有效文章 URL
- 调用 Supabase RPC 函数清理无效记录
- 输出清理统计信息

**使用方法：**

```bash
# 本地执行（需要设置环境变量）
cd papercache
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_KEY="your-service-role-key"
python3 scripts/sync_supabase_with_posts.py
```

**环境变量：**
- `SUPABASE_URL`：Supabase 项目 URL
- `SUPABASE_SERVICE_KEY`：Service Role Key（绕过 RLS，需要管理员权限）
  - 获取方式：Supabase Dashboard → Settings → API → `service_role` key

### 3. GitHub Actions 自动同步

**集成位置：** `.github/workflows/deploy-pages.yml`

**自动执行时机：**
- ✅ 每次推送到 `main` 分支
- ✅ 构建完成后自动执行
- ✅ 如果失败，不会阻止部署（`continue-on-error: true`）

**需要的 GitHub Secrets：**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`（新增）

**配置步骤：**
1. 访问 GitHub 仓库 → Settings → Secrets and variables → Actions
2. 添加新的 Secret：`SUPABASE_SERVICE_KEY`
3. 值：Supabase Dashboard → Settings → API → `service_role` key

## 🚀 完整流程

### 首次设置

1. **部署 Supabase 函数：**
   ```sql
   -- 在 Supabase Dashboard → SQL Editor 中执行
   -- 复制并执行 scripts/supabase-cleanup-orphan-records.sql
   ```

2. **配置 GitHub Secrets：**
   - `SUPABASE_URL`（已有）
   - `SUPABASE_SERVICE_KEY`（新增）

3. **推送代码：**
   ```bash
   git add scripts/sync_supabase_with_posts.py
   git add .github/workflows/deploy-pages.yml
   git commit -m "Add Supabase sync automation"
   git push origin main
   ```

### 日常使用

**添加文章：**
```bash
# 1. 添加文章文件
git add _posts/new-article.html
git commit -m "Add new article"
git push origin main

# 2. GitHub Actions 自动执行：
# ✅ 构建站点
# ✅ 清理 Supabase（无需手动操作）
```

**删除文章：**
```bash
# 1. 删除文章文件
git rm _posts/old-article.html
git commit -m "Remove old article"
git push origin main

# 2. GitHub Actions 自动执行：
# ✅ 构建站点
# ✅ 清理 Supabase 中的无效记录（自动）
```

**手动触发清理：**
```bash
# 如果需要立即清理，可以手动执行脚本
cd papercache
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_KEY="your-service-role-key"
python3 scripts/sync_supabase_with_posts.py
```

## 📊 清理统计示例

脚本执行后会输出类似信息：

```
============================================================
🔄 Supabase 与论文文章同步脚本
============================================================

📚 步骤 1: 扫描文章文件...
✅ 找到 286 篇有效文章

🗑️  步骤 2: 清理 Supabase 无效记录...
🔄 开始清理 Supabase 无效记录...
   有效文章数量: 286
✅ 清理完成:
   - 删除收藏记录: 5 条
   - 无效收藏 URL (前5个): /papers/old-article-1.html, /papers/old-article-2.html
   - 删除点击统计: 3 条
   - 无效点击统计 URL (前5个): /papers/old-article-1.html

============================================================
✅ 同步完成!
============================================================
📊 清理统计:
   - 收藏记录: 5 条已删除
   - 点击统计: 3 条已删除
```

## 🔒 安全注意事项

### Service Role Key 安全

**重要：** `SUPABASE_SERVICE_KEY` 具有完整数据库访问权限，必须保密！

**最佳实践：**
- ✅ 只在 GitHub Secrets 中存储
- ✅ 不要在代码中硬编码
- ✅ 不要提交到 Git
- ✅ 定期轮换密钥

### RLS（Row Level Security）

清理函数使用 `SECURITY DEFINER`，可以绕过 RLS 策略。这是必要的，因为：
- 需要删除所有用户的收藏记录（不仅限于当前用户）
- 需要清理所有无效的点击统计

## 🐛 故障排除

### 问题 1: "Supabase RPC 调用失败"

**原因：** 函数未部署或 URL 格式错误

**解决：**
1. 检查函数是否在 Supabase Dashboard 中部署
2. 验证 `SUPABASE_URL` 格式正确（应包含 `https://`）

### 问题 2: "权限被拒绝"

**原因：** Service Role Key 未设置或无效

**解决：**
1. 确认 `SUPABASE_SERVICE_KEY` 已正确设置
2. 检查密钥是否有效（在 Supabase Dashboard 中查看）

### 问题 3: "没有找到任何文章"

**原因：** `_posts/` 目录路径错误

**解决：**
1. 确认脚本在 `papercache/` 目录下执行
2. 检查 `_posts/` 目录是否存在

### 问题 4: 清理后仍有无效记录

**可能原因：**
- URL 格式不一致（规范化问题）
- 文章使用了不同的 URL 格式

**解决：**
1. 检查 `normalize_url()` 函数是否正确处理所有 URL 格式
2. 查看 Supabase 中的实际 URL 格式
3. 调整规范化逻辑

## 📝 手动测试

### 测试清理函数

```sql
-- 在 Supabase Dashboard → SQL Editor 中执行

-- 1. 查看当前无效记录数量（示例）
SELECT COUNT(*) FROM favorites 
WHERE post_url NOT IN (
  SELECT '/papers/llm/algorithm/2024/01/01/some-article.html'::TEXT
  -- 替换为实际的有效 URL
);

-- 2. 测试清理函数
SELECT * FROM cleanup_all_invalid_records(
  ARRAY[
    '/papers/llm/algorithm/2024/01/01/some-article.html',
    '/papers/llm/engineering/2024/02/01/another-article.html'
    -- 添加更多有效 URL
  ]
);
```

### 测试同步脚本

```bash
# 1. 设置环境变量
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_KEY="your-service-role-key"

# 2. 运行脚本（使用 --dry-run 选项查看会删除什么）
python3 scripts/sync_supabase_with_posts.py
```

## 🔄 定期维护

**建议：**
- ✅ 每次部署时自动执行（已集成到 GitHub Actions）
- ✅ 每月手动检查一次数据库状态
- ✅ 监控清理统计，如果删除数量异常，检查原因

## 📚 相关文档

- [部署流程说明](./DEPLOYMENT_FLOW.md)
- [Supabase 设置指南](../scripts/setup-supabase.md)
- [GitHub Actions 配置](../.github/workflows/deploy-pages.yml)

