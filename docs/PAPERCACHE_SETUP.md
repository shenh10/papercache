# PaperCache 仓库设置指南

## 🎯 目标架构

```
deep_notes (源仓库)                    papercache (展示仓库)
├── 📄 论文HTML文件                    ├── 🔄 自动接收部署内容
├── 🛠️ 转换脚本                       ├── 📝 Jekyll文章
├── 📚 研究笔记                        ├── 🎨 主题和布局
├── 🤖 GitHub Actions                  ├── 💬 评论系统
└── 🔧 自动化配置                      └── 📊 统计功能
      ↓                                      ↓
   自动转换和部署                      GitHub Pages
                                    https://shenh10.github.io/papercache
```

## 📋 设置步骤

### 第一步：创建papercache仓库

1. **在GitHub创建新仓库**
   - 仓库名称: `papercache`
   - 描述: `Deep Notes - AI/ML研究论文缓存和展示站点`
   - 可见性: **Public** (GitHub Pages免费版需要)
   - 不要添加README、.gitignore、LICENSE

2. **启用GitHub Pages**

   ```bash
   # 进入papercache仓库设置
   Settings → Pages → Source: "Deploy from a branch"
   Branch: "main" / "/ (root)"
   ```

3. **启用Discussions** (用于评论系统)
   ```bash
   Settings → General → Features → ✅ Discussions
   ```

### 第二步：在deep_notes中配置自动化部署

1. **设置GitHub Personal Access Token**

   按照之前的指南创建PAT，确保有以下权限：
   - `repo` (完整仓库访问)
   - `workflow` (GitHub Actions)

   在deep_notes仓库中添加Secret：
   - Name: `GH_PAT`
   - Value: 您的Personal Access Token

2. **复制部署配置文件**

   ```bash
   # 在deep_notes仓库中
   mkdir -p .github/workflows
   cp deploy_to_papercache.yml .github/workflows/
   ```

3. **添加papercache配置**
   ```bash
   # 确保以下文件在deep_notes根目录
   cp papercache_config.yml ./  # PaperCache的Jekyll配置
   ```

### 第三步：首次部署

1. **提交配置到deep_notes**

   ```bash
   cd deep_notes
   git add .github/workflows/deploy_to_papercache.yml
   git add papercache_config.yml
   git commit -m "添加PaperCache自动化部署配置"
   git push origin main
   ```

2. **检查GitHub Actions执行**
   - 访问 `https://github.com/shenh10/deep_notes/actions`
   - 查看"Deploy to PaperCache"工作流状态

3. **验证papercache内容**
   - 访问 `https://github.com/shenh10/papercache`
   - 确认内容已自动生成
   - 访问 `https://shenh10.github.io/papercache`

## 🔧 papercache仓库结构

部署完成后，papercache仓库将包含：

```
papercache/
├── 📝 _posts/                          # 转换后的论文文章
│   ├── 2023-10-01-fireact-paper.html
│   ├── 2024-07-01-flashattention.html
│   └── ...
├── 🎨 _layouts/                         # Jekyll布局
│   └── post.html
├── 🧩 _includes/                        # Jekyll组件
│   ├── comments.html
│   ├── analytics.html
│   ├── head.html
│   └── footer.html
├── 📊 assets/                           # 静态资源
│   ├── css/
│   ├── js/
│   └── images/
├── ⚙️ _config.yml                       # Jekyll配置
├── 📄 index.markdown                    # 主页
├── 📋 Gemfile                           # Ruby依赖
├── 📖 README.md                         # 项目说明
└── 📋 DEPLOY_INFO.md                    # 部署信息
```

## 🎨 评论系统配置

### 配置Giscus

1. **安装Giscus应用**
   - 访问 [GitHub Apps - giscus](https://github.com/apps/giscus)
   - 选择 `papercache` 仓库并安装

2. **获取配置参数**
   - 访问 [Giscus配置页面](https://giscus.app/zh-CN)
   - 仓库: `shenh10/papercache`
   - 映射: "Discussion的标题包含页面的pathname"
   - 分类: "General" 或创建专门的"Comments"分类

3. **更新配置**
   在 `papercache_config.yml` 中更新：
   ```yaml
   giscus:
     repo: "shenh10/papercache"
     repo_id: "获取的实际repo_id"
     category: "General"
     category_id: "获取的实际category_id"
   ```

## 📊 统计系统配置

### Google Analytics 4

1. **创建GA4账户**
   - 网站URL: `https://shenh10.github.io/papercache`
   - 获取测量ID (格式: G-XXXXXXXXXX)

2. **更新配置**
   在 `papercache_config.yml` 中：
   ```yaml
   google_analytics: "G-YOUR-MEASUREMENT-ID"
   ```

### 不蒜子计数器

已默认启用，无需额外配置：

```yaml
busuanzi_analytics: true
```

## 🔄 日常使用流程

### 添加新论文

1. **在deep_notes中添加HTML文件**

   ```bash
   # 例如添加新的论文
   cp new_paper.html llm/algorithm/models/2024-08-new-model.html
   ```

2. **提交更改**

   ```bash
   git add llm/algorithm/models/2024-08-new-model.html
   git commit -m "添加新论文: New Model Architecture"
   git push origin main
   ```

3. **自动化流程**
   - GitHub Actions自动检测变更
   - 转换HTML为Jekyll格式
   - 部署到papercache仓库
   - GitHub Pages自动发布

### 更新现有内容

1. **修改deep_notes中的文件**

   ```bash
   vim llm/engineering/attention/existing-paper.html
   ```

2. **提交更改**

   ```bash
   git commit -am "更新论文内容: 修复公式显示问题"
   git push origin main
   ```

3. **等待自动部署** (通常2-5分钟)

## 🛠️ 维护和监控

### 检查部署状态

1. **GitHub Actions日志**

   ```
   https://github.com/shenh10/deep_notes/actions
   ```

2. **papercache仓库状态**

   ```
   https://github.com/shenh10/papercache
   ```

3. **网站可用性**
   ```
   https://shenh10.github.io/papercache
   ```

### 故障排除

#### 部署失败

```bash
# 检查PAT权限
curl -H "Authorization: token $GH_PAT" \
  https://api.github.com/repos/shenh10/papercache

# 查看Actions日志中的具体错误信息
```

#### 网站无法访问

```bash
# 检查GitHub Pages设置
# Settings → Pages → 确认分支和路径正确

# 检查_config.yml语法
python -c "import yaml; yaml.safe_load(open('_config.yml'))"
```

#### 评论系统问题

```bash
# 确认Discussions已启用
# 检查Giscus配置参数
# 验证repo_id和category_id
```

## 📈 优势总结

### 🔒 职责分离

- **deep_notes**: 专注内容创作和源代码管理
- **papercache**: 专注展示和用户交互

### 🚀 自动化优势

- 推送即发布，零手工维护
- 版本控制和回滚能力
- 构建失败自动通知

### 💬 用户体验

- 基于GitHub的原生评论系统
- 专业的访客统计分析
- 快速的CDN加速访问

### 🔧 开发友好

- 保持现有开发流程
- 清晰的架构分离
- 易于扩展和维护

## 🎉 完成确认

配置完成后，您将拥有：

✅ **deep_notes** - 私有化的源代码管理仓库  
✅ **papercache** - 专业的论文展示站点  
✅ **自动化部署** - 推送即发布的工作流  
✅ **评论交互** - 基于GitHub Discussions  
✅ **访客统计** - GA4 + 不蒜子双重统计  
✅ **美观主题** - 统一的Jekyll布局

现在您可以专注于在deep_notes中创作内容，papercache会自动为您展示最新的研究成果！🎊

