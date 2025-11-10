# GitHub Secrets 配置指南

## 问题

如果看到错误：`⚠️ Supabase 配置未找到，无法加载数据`，说明 GitHub Secrets 中未配置 Supabase 环境变量。

## 解决方案

### 步骤 1: 获取 Supabase 配置

1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择你的项目
3. 进入 **Settings** → **API**
4. 复制以下信息：
   - **Project URL** → 这是 `SUPABASE_URL`
   - **anon public** key → 这是 `SUPABASE_ANON_KEY`
   - **service_role** key → 这是 `SUPABASE_SERVICE_KEY`（可选，用于后台同步）

### 步骤 2: 在 GitHub 中设置 Secrets

1. 打开你的 GitHub 仓库
2. 进入 **Settings** → **Secrets and variables** → **Actions**
3. 点击 **New repository secret** 添加以下 secrets：

#### 必需的 Secrets：

**SUPABASE_URL**
- Name: `SUPABASE_URL`
- Value: `https://your-project-id.supabase.co`
- 示例: `https://dlwudpirfvzidtthoxtv.supabase.co`

**SUPABASE_ANON_KEY**
- Name: `SUPABASE_ANON_KEY`
- Value: 你的 anon public key（以 `eyJhbGci...` 开头）
- 示例: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

#### 可选的 Secrets（用于后台同步）：

**SUPABASE_SERVICE_KEY**
- Name: `SUPABASE_SERVICE_KEY`
- Value: 你的 service_role key（以 `eyJhbGci...` 开头）
- 用途：用于后台脚本同步数据（如清理无效记录）
- ⚠️ **注意**：这个 key 有管理员权限，请妥善保管

### 步骤 3: 验证配置

1. 推送一个小的改动到 `main` 分支（或手动触发 GitHub Actions）
2. 查看 GitHub Actions 日志：
   - 进入仓库的 **Actions** 标签
   - 查看最新的 workflow run
   - 在 "🔧 Inject Supabase config from environment" 步骤中应该看到：
     ```
     注入 Supabase 配置...
     ```
   而不是：
     ```
     ⚠️  Supabase 环境变量未设置，跳过配置注入
     ```

### 步骤 4: 重新部署

配置完成后，需要重新触发部署：

**方法 1: 手动触发**
1. 进入 **Actions** 标签
2. 选择 "Deploy Jekyll site to Pages" workflow
3. 点击 **Run workflow** → **Run workflow**

**方法 2: 推送一个空提交**
```bash
git commit --allow-empty -m "触发重新部署以应用 Supabase 配置"
git push origin main
```

## 验证部署是否成功

部署完成后，访问你的网站，检查浏览器控制台：

1. 打开浏览器开发者工具（F12）
2. 查看 Console 标签
3. 应该看到：
   ```
   [supabase-client] Supabase 客户端已初始化
   ```
   而不是：
   ```
   ⚠️ Supabase 配置未找到，用户系统功能将不可用
   ```

## 常见问题

### Q: 为什么需要设置 GitHub Secrets？

A: 因为 `_config.yml` 文件会被提交到 Git，不能包含敏感信息。GitHub Secrets 允许在构建时安全地注入配置，而不会暴露在代码仓库中。

### Q: 配置后仍然显示错误？

A: 检查以下几点：
1. Secrets 名称是否正确（区分大小写）
2. Secrets 值是否正确（没有多余的空格或换行）
3. 是否重新触发了部署
4. 查看 GitHub Actions 日志确认配置是否被注入

### Q: 本地开发需要设置吗？

A: 不需要。本地开发使用 `.env.local` 文件（不提交到 Git），通过 `./scripts/load-env-to-config.sh` 同步到 `_config_local.yml`。

## 安全提醒

⚠️ **重要**：
- 永远不要将 Supabase keys 提交到 Git
- `SUPABASE_ANON_KEY` 是公开的，可以暴露在前端代码中
- `SUPABASE_SERVICE_KEY` 有管理员权限，**绝对不能**暴露在前端代码中
- 如果怀疑 key 泄露，立即在 Supabase Dashboard 中重新生成


