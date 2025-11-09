# 部署流程说明

## 📋 概述

当你通过 `git` 更改论文文章时，系统的更新流程如下：

## 🔄 自动更新流程

### 1. **GitHub Pages (Jekyll 静态站点)** ✅ 自动更新

当你推送代码到 `main` 分支时：

```
Git Push → GitHub → GitHub Actions → 自动构建 → 部署到 GitHub Pages
```

**触发条件：**
- ✅ 推送到 `main` 分支
- ✅ 收到 `repository_dispatch` 事件（从 deepnotes 同步触发）
- ✅ 手动触发 workflow

**自动执行的操作：**
1. 构建 Jekyll 站点
2. 生成摘要映射 (`excerpts.json`)
3. 生成缩略图 (`thumbnails_by_path.yml`)
4. **注入 Supabase 配置**（从 GitHub Secrets）
5. 重新构建并部署到 GitHub Pages

**Supabase 配置注入：**
- 从 GitHub Secrets 读取：`SUPABASE_URL` 和 `SUPABASE_ANON_KEY`
- 通过 `scripts/inject-env-to-config.py` 注入到 `_config.yml`
- 确保前端代码可以访问 Supabase 服务

**配置文件：**
- `.github/workflows/deploy-pages.yml`

---

### 2. **Vercel (Serverless Functions)** ⚠️ 需要确认连接

**自动部署条件：**
- ✅ Vercel 项目已连接到 GitHub 仓库
- ✅ 配置了自动部署（默认已启用）

**如何确认 Vercel 是否已连接：**
1. 访问 [Vercel Dashboard](https://vercel.com/dashboard)
2. 检查你的项目是否显示 "Connected to GitHub"
3. 查看项目的 "Settings" → "Git" 确认连接状态

**如果已连接：**
```
Git Push → GitHub → Vercel 自动检测 → 自动构建 → 部署 API Functions
```

**如果未连接：**
- 需要在 Vercel Dashboard 手动连接 GitHub 仓库
- 或者手动部署：`vercel --prod`

**Vercel Functions 包含：**
- `/api/search.js` - 搜索 API
- `/api/suggestions.js` - 搜索建议 API  
- `/api/stats.js` - 统计数据 API
- `/api/get-clicks.js` - 点击统计 API（已迁移到 Supabase，可能已废弃）
- `/api/track-click.js` - 点击跟踪 API（已迁移到 Supabase，可能已废弃）

**配置文件：**
- `vercel.json`

---

### 3. **Supabase (数据库)** ❌ 不会自动更新

**重要：Supabase 不会因为 git push 而自动更新！**

**Supabase 存储的数据：**
- ✅ 用户收藏 (`favorites` 表)
- ✅ 点击统计 (`post_clicks` 表)
- ✅ 用户资料 (`profiles` 表)
- ✅ 登录日志 (`login_logs` 表)

**论文文章本身：**
- ❌ **不存储在 Supabase 中**
- ✅ 存储在 GitHub 仓库的 `_posts/` 目录
- ✅ 通过 Jekyll 构建成静态 HTML

**Supabase 配置更新：**
- 当你更改了 Supabase 相关的 SQL 函数（如 `supabase-favorites-stats.sql`）时：
  1. 需要**手动**在 Supabase Dashboard 的 SQL Editor 中执行
  2. 或者使用 Supabase CLI 部署：
     ```bash
     supabase db push
     ```

**环境变量配置：**
- GitHub Pages：通过 GitHub Secrets 配置
- Vercel：通过 Vercel Dashboard → Settings → Environment Variables 配置

---

## 📝 更新不同类型内容的流程

### 场景 1: 添加新论文

```bash
# 1. 添加新论文文件
git add _posts/new-paper.html
git commit -m "Add new paper"
git push origin main

# 自动触发：
# ✅ GitHub Actions 构建并部署到 GitHub Pages
# ✅ Vercel 自动部署 API（如果已连接）
# ❌ Supabase 无需操作（论文不存储在数据库）
```

### 场景 2: 更新 Supabase SQL 函数

```bash
# 1. 更新 SQL 文件
git add scripts/supabase-favorites-stats.sql
git commit -m "Update Supabase functions"
git push origin main

# 2. 手动在 Supabase Dashboard 执行 SQL
# 访问：Supabase Dashboard → SQL Editor
# 执行：scripts/supabase-favorites-stats.sql 中的 SQL 语句
```

### 场景 3: 更新前端代码（使用 Supabase）

```bash
# 1. 更新代码
git add assets/js/favorites.js
git commit -m "Update favorites functionality"
git push origin main

# 自动触发：
# ✅ GitHub Actions 构建并部署（包含 Supabase 配置）
# ✅ Vercel 自动部署（如果已连接）
# ❌ Supabase 无需操作（只是前端代码更新）
```

### 场景 4: 更新环境变量

**GitHub Pages (Supabase 配置):**
1. 访问 GitHub 仓库 → Settings → Secrets and variables → Actions
2. 更新 `SUPABASE_URL` 或 `SUPABASE_ANON_KEY`
3. 重新触发部署或推送代码

**Vercel (如果需要):**
1. 访问 Vercel Dashboard → Project Settings → Environment Variables
2. 更新环境变量
3. 重新部署

---

## 🔍 检查部署状态

### 检查 GitHub Pages 部署

```bash
# 查看 GitHub Actions 运行状态
# 访问：GitHub 仓库 → Actions 标签页
```

### 检查 Vercel 部署

```bash
# 使用 Vercel CLI
vercel ls

# 查看部署日志
vercel logs

# 或者访问 Vercel Dashboard
```

### 检查 Supabase

```bash
# 使用 Supabase CLI（如果已安装）
supabase status

# 或者访问 Supabase Dashboard
```

---

## ⚙️ 手动触发部署

### GitHub Pages

```bash
# 方法 1: 推送空提交
git commit --allow-empty -m "Trigger deployment"
git push origin main

# 方法 2: 通过 GitHub UI
# 访问：Actions → Deploy Jekyll site to Pages → Run workflow
```

### Vercel

```bash
# 手动部署到生产环境
vercel --prod

# 或者通过 Vercel Dashboard
# 访问：Deployments → Redeploy
```

---

## 🚨 常见问题

### Q: 推送代码后，网站没有更新？

**检查清单：**
1. ✅ GitHub Actions 是否运行成功？
   - 访问：GitHub 仓库 → Actions
2. ✅ Vercel 部署是否成功？
   - 检查 Vercel Dashboard
3. ✅ 浏览器缓存是否已清除？
   - 尝试硬刷新：`Ctrl+Shift+R` (Windows) 或 `Cmd+Shift+R` (Mac)

### Q: Supabase 配置没有生效？

**检查清单：**
1. ✅ GitHub Secrets 是否已正确配置？
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
2. ✅ `scripts/inject-env-to-config.py` 是否执行？
   - 查看 GitHub Actions 日志
3. ✅ `_config.yml` 中是否包含 Supabase 配置？
   - 检查构建后的 `_site/_config.yml`（如果暴露）

### Q: Vercel API 没有更新？

**检查清单：**
1. ✅ Vercel 项目是否连接到 GitHub？
2. ✅ 是否启用了自动部署？
3. ✅ `vercel.json` 配置是否正确？

---

## 📚 相关文档

- [GitHub Pages 部署配置](./.github/workflows/deploy-pages.yml)
- [Vercel 部署指南](../VERCEL_DEPLOYMENT.md)
- [Supabase 设置指南](./scripts/setup-supabase.md)

---

## 总结

| 服务 | 自动更新？ | 触发方式 | 备注 |
|------|----------|---------|------|
| **GitHub Pages** | ✅ 是 | Git Push 到 main | 自动构建并部署 |
| **Vercel** | ⚠️ 需确认 | Git Push（如果已连接） | 需要连接 GitHub 仓库 |
| **Supabase** | ❌ 否 | 手动执行 SQL | 论文不存储在数据库 |
| **Supabase 配置** | ✅ 是 | Git Push（通过 Secrets） | 环境变量自动注入 |

**关键点：**
- ✅ **GitHub Pages** 和 **Vercel** 会在你推送代码时自动更新
- ✅ **Supabase 环境变量** 会自动注入，无需手动配置
- ❌ **Supabase SQL 函数** 需要手动在 Dashboard 执行



