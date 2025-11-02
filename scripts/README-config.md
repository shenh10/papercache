# 配置文件说明

## 配置文件安全策略

### 为什么 `_config_local.yml` 保持为空？

`_config_local.yml` 会被提交到 Git，因此**不能包含真实的 Supabase 密钥**。

### 本地开发配置流程

1. **创建 `.env.local` 文件**（不提交到 Git）：
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   ```

2. **运行同步脚本**（每次修改 `.env.local` 后）：
   ```bash
   ./scripts/load-env-to-config.sh
   ```
   脚本会从 `.env.local` 读取配置并更新 `_config_local.yml`

3. **本地开发时使用**：
   ```bash
   bundle exec jekyll serve --config _config.yml,_config_local.yml
   ```

### 文件状态说明

- ✅ `.env.local`：包含真实密钥，**不提交到 Git**（在 `.gitignore` 中）
- ✅ `_config_local.yml`：本地开发配置，**提交到 Git**（但保持为空，运行时从 `.env.local` 同步）
- ✅ `_config.yml`：生产配置，**提交到 Git**（保持为空，构建时从环境变量注入）

### 生产环境配置

- **Vercel**：通过 Vercel Dashboard 设置环境变量，构建时自动注入
- **GitHub Pages**：通过 GitHub Secrets 设置，构建时自动注入

## 安全提醒

⚠️ **重要**：
- 永远不要将真实密钥提交到 Git
- `_config_local.yml` 应该只包含空值或占位符
- 真实密钥只存储在 `.env.local`（本地）或环境变量/Secrets（生产环境）

