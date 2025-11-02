# Supabase项目设置指南

## 第一步：创建Supabase项目

1. 访问 https://supabase.com/
2. 使用GitHub账号登录
3. 点击"New Project"
4. 填写项目信息：
   - Organization: 选择或创建组织
   - Name: `papercache` 或自定义
   - Database Password: 设置强密码（保存好！）
   - Region: 选择离用户最近的区域（推荐 `Southeast Asia (Singapore)`）
5. 等待项目创建完成（约2分钟）

## 第二步：获取API密钥

1. 进入项目 Dashboard
2. 点击左侧菜单 "Settings" → "API"
3. 复制以下信息：
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon/public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsd3VkcGlyZnZ6aWR0dGhveHR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIwNTU5MTksImV4cCI6MjA3NzYzMTkxOX0.mW5FtqF72BgdUMuS1-KcJMF3VIqnGsnzTS5sF59wYjY` (公开的，可以在前端使用)
   - **service_role key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (保密的，仅服务器端使用)

## 第三步：配置OAuth提供商

**重要说明：** Supabase的OAuth回调URL格式是固定的，不需要从URL Configuration页面获取。格式为：
```
https://<your-project-ref>.supabase.co/auth/v1/callback
```

其中 `<your-project-ref>` 是你的项目引用ID（可以在Supabase Dashboard的项目设置中找到，通常是随机字符串）。

### 如何找到你的项目引用ID

1. 在Supabase Dashboard，点击左侧菜单的 **Settings** (⚙️)
2. 点击 **General**
3. 在 **Reference ID** 部分，你会看到类似 `abcdefghijklmnop` 的ID
4. 完整的回调URL就是：`https://abcdefghijklmnop.supabase.co/auth/v1/callback`

### GitHub OAuth配置

1. 访问 https://github.com/settings/developers
2. 点击 **"New OAuth App"**
3. 填写信息：
   - **Application name**: `PaperCache`
   - **Homepage URL**: `https://shenh10.github.io/papercache`
   - **Authorization callback URL**: `https://<your-project-ref>.supabase.co/auth/v1/callback`
     - 将 `<your-project-ref>` 替换为你的实际项目引用ID
     - 例如：`https://abcdefghijklmnop.supabase.co/auth/v1/callback`
4. 点击 **"Register application"**
5. 复制生成的 **Client ID** 和 **Client Secret**（点击 "Generate a new client secret"）
6. 在Supabase Dashboard → **Authentication** → **Providers** → **GitHub**
7. 填入：
   - **Client ID (for OAuth App)**: 粘贴GitHub的Client ID
   - **Client Secret (for OAuth App)**: 粘贴GitHub的Client Secret
8. 点击 **"Save"** 或启用开关

### Google OAuth配置

1. 访问 https://console.cloud.google.com/
2. 创建新项目或选择现有项目
3. 启用 **Google+ API**（如果需要）
4. 进入 **APIs & Services** → **Credentials**
5. 点击 **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
6. 如果首次使用，先配置 **OAuth consent screen**
7. 创建OAuth客户端时：
   - **Application type**: 选择 **"Web application"**
   - **Name**: `PaperCache`
   - **Authorized redirect URIs**: 添加 `https://<your-project-ref>.supabase.co/auth/v1/callback`
     - 将 `<your-project-ref>` 替换为你的实际项目引用ID
8. 点击 **"Create"**
9. 复制生成的 **Client ID** 和 **Client Secret**
10. 在Supabase Dashboard → **Authentication** → **Providers** → **Google**
11. 填入：
    - **Client ID (for OAuth App)**: 粘贴Google的Client ID
    - **Client Secret (for OAuth App)**: 粘贴Google的Client Secret
12. 点击 **"Save"** 或启用开关

## 第四步：配置项目URL

在Supabase Dashboard → **Authentication** → **URL Configuration**：

### Site URL
- 设置为你的网站主URL：`https://shenh10.github.io/papercache`
- 这是默认的重定向URL，也是邮件模板中使用的变量

### Redirect URLs
添加你的网站允许重定向的URL（支持通配符）：
- `https://shenh10.github.io/papercache/**` （所有子路径）
- 如果需要，也可以添加 `https://shenh10.github.io/papercache` （根路径）

**注意**：
- **OAuth回调URL** (`https://<project-ref>.supabase.co/auth/v1/callback`) 是固定的，由Supabase管理，不需要在这里添加
- **Redirect URLs** 是用来配置OAuth登录成功后，Supabase可以重定向回你网站的哪些URL

## 第五步：执行数据库脚本

1. 进入 Supabase Dashboard → SQL Editor
2. 执行 `scripts/supabase-schema.sql` 中的SQL语句
3. 执行 `scripts/supabase-rls.sql` 中的RLS策略

## 第六步：配置本地开发环境

### 方法一：使用脚本自动同步（推荐）

1. 创建 `.env.local` 文件（不提交到git，已在.gitignore中）：
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

2. 运行脚本自动更新配置：
```bash
chmod +x scripts/load-env-to-config.sh
./scripts/load-env-to-config.sh
```

脚本会自动从 `.env.local` 读取配置并更新 `_config_local.yml`。

### 方法二：手动配置

1. 创建 `.env.local` 文件：
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

2. 手动编辑 `_config_local.yml`，在文件末尾添加：
```yaml
supabase:
  url: "https://your-project.supabase.co"  # 从 .env.local 复制
  anon_key: "your-anon-key"  # 从 .env.local 复制
  enabled: true
```

### 验证配置

本地开发时使用：
```bash
bundle exec jekyll serve --config _config.yml,_config_local.yml
```

配置成功后，页面头部应该显示登录按钮（如果Supabase已正确配置）。

## 第七步：配置生产环境

### Vercel部署

1. 在 Vercel Dashboard → **Project Settings** → **Environment Variables** 中添加：
   - `SUPABASE_URL`: `https://your-project.supabase.co`
   - `SUPABASE_ANON_KEY`: `your-anon-key`

2. 配置已完成！构建时会自动从环境变量注入到 `_config.yml`。

   `vercel.json` 中的构建命令已配置为：
   ```json
   "buildCommand": "python3 scripts/inject-env-to-config.py && JEKYLL_ENV=production bundle exec jekyll build"
   ```

3. 重新部署项目，配置会自动生效。

### GitHub Pages部署

1. 在 GitHub 仓库中设置 Secrets：
   - 进入 **Settings** → **Secrets and variables** → **Actions**
   - 点击 **New repository secret**
   - 添加以下两个 secrets：
     - `SUPABASE_URL`: `https://your-project.supabase.co`
     - `SUPABASE_ANON_KEY`: `your-anon-key`

2. 配置已完成！GitHub Actions workflow 已更新为自动注入配置。

   在 `.github/workflows/deploy-pages.yml` 中，构建步骤会自动执行：
   ```yaml
   - name: 🔧 Inject Supabase config from environment
     run: python3 scripts/inject-env-to-config.py
     env:
       SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
       SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
   ```

3. 推送代码或触发 workflow，配置会自动生效。

### 重要提示

⚠️ **安全提醒**：
- `.env.local` 文件已在 `.gitignore` 中，不会提交到Git
- `_config_local.yml` 中的敏感信息也不会提交（如果包含真实密钥，建议也加入.gitignore）
- 生产环境的密钥应该通过环境变量或密钥管理服务配置，不要硬编码在代码中

