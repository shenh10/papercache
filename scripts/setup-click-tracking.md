# 点击统计服务器端配置指南

## 方案说明

本方案使用GitHub Gist作为数据存储，通过Vercel Serverless Functions处理API请求。

## 配置步骤

### 1. 创建GitHub Gist

1. 访问 https://gist.github.com/
2. 创建一个新的公开Gist（Public）
3. 文件名：`post_clicks.json`
4. 内容：`{}`（空的JSON对象）
5. 复制Gist ID（URL中的长字符串，例如：`a1b2c3d4e5f6g7h8i9j0`）

### 2. 创建GitHub Personal Access Token

1. 访问 https://github.com/settings/tokens
2. 点击 "Generate new token (classic)"
3. 设置权限：
   - `gist` 权限（勾选）
4. 生成并复制token（只显示一次，请保存好）

### 3. 配置环境变量

#### 如果在Vercel部署：

1. 在Vercel项目设置中添加环境变量：
   - `GITHUB_GIST_ID`: 你的Gist ID
   - `GITHUB_TOKEN`: 你的GitHub Personal Access Token

#### 如果在GitHub Pages部署（需要改用其他方案）：

GitHub Pages不支持serverless functions，建议：
- 使用GitHub Actions定期更新数据文件
- 或使用其他serverless平台（Netlify Functions等）

### 4. 部署API

API文件位于 `api/` 目录：
- `track-click.js`: 记录点击
- `get-clicks.js`: 获取统计数据

这些文件需要部署到支持serverless functions的平台（如Vercel）。

## 备选方案

如果不想使用GitHub Gist，可以考虑：

1. **Firebase Realtime Database** - 免费的实时数据库
2. **Supabase** - 开源的后端即服务
3. **GitHub Actions + 数据文件** - 通过GitHub Actions更新 `_data/post_clicks.json`

## 测试

部署后，可以测试：
- 访问 `/api/get-clicks` 应该返回空的JSON对象 `{}`
- 点击文章链接后，调用 `/api/track-click` 应该增加计数


