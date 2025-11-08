# 配置文件说明

## 配置文件安全策略

### 为什么 `_config_local.yml` 保持为空？

`_config_local.yml` 会被提交到 Git，因此**不能包含真实的 Supabase 密钥**。

### 本地开发配置流程

#### 1. 首次设置（仅需一次）

设置 Git pre-commit hook（防止误提交敏感信息）：
```bash
./scripts/setup-git-hooks.sh
```

#### 2. 配置 Supabase（仅需一次）

创建 `.env.local` 文件（不提交到 Git）：
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

#### 3. 同步配置到 `_config_local.yml`（每次修改 `.env.local` 后运行）

```bash
./scripts/load-env-to-config.sh
```

**重要**：这个脚本需要**手动运行**，通常在以下情况：
- 首次配置 Supabase
- 修改了 `.env.local` 中的配置
- 从 Git 拉取代码后（如果 `_config_local.yml` 被重置为空）

#### 4. 本地开发

```bash
bundle exec jekyll serve --config _config.yml,_config_local.yml
```

### 如何防止误提交敏感信息？

1. **Git pre-commit hook**（自动检查）
   - 运行 `./scripts/setup-git-hooks.sh` 安装
   - 每次 `git commit` 前自动检查 `_config_local.yml` 是否包含敏感信息
   - 如果检测到，会阻止提交并提示

2. **手动检查清单**（提交前）
   - ✅ `.env.local` 不在暂存区（`git status` 检查）
   - ✅ `_config_local.yml` 中的 `url` 和 `anon_key` 为空字符串

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

