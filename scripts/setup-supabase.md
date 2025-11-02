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
   - **anon/public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (公开的，可以在前端使用)
   - **service_role key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (保密的，仅服务器端使用)

## 第三步：配置OAuth提供商

### GitHub OAuth

1. 访问 https://github.com/settings/developers
2. 点击 "New OAuth App"
3. 填写信息：
   - Application name: `PaperCache`
   - Homepage URL: `https://shenh10.github.io/papercache`
   - Authorization callback URL: `https://your-project.supabase.co/auth/v1/callback`
   - 从Supabase Dashboard → Authentication → URL Configuration 获取准确的回调URL
4. 复制 **Client ID** 和 **Client Secret**
5. 在Supabase Dashboard → Authentication → Providers → GitHub
6. 填入 Client ID 和 Client Secret
7. 启用 GitHub provider

### Google OAuth

1. 访问 https://console.cloud.google.com/
2. 创建新项目或选择现有项目
3. 启用 Google+ API
4. 创建 OAuth 2.0 客户端ID
5. 添加授权回调URL：`https://your-project.supabase.co/auth/v1/callback`
6. 复制 **Client ID** 和 **Client Secret**
7. 在Supabase Dashboard → Authentication → Providers → Google
8. 填入 Client ID 和 Client Secret
9. 启用 Google provider

## 第四步：配置项目URL

在Supabase Dashboard → Authentication → URL Configuration：
- Site URL: `https://shenh10.github.io/papercache`
- Redirect URLs: 添加 `https://shenh10.github.io/papercache/**`

## 第五步：执行数据库脚本

1. 进入 Supabase Dashboard → SQL Editor
2. 执行 `scripts/supabase-schema.sql` 中的SQL语句
3. 执行 `scripts/supabase-rls.sql` 中的RLS策略

## 第六步：配置本地环境

创建 `.env.local` 文件（不提交到git）：
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

然后在 `_config.yml` 中添加配置（使用环境变量或直接配置，根据部署方式选择）

