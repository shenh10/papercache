# PaperCache 重启对话 · 要点与实施计划

本文件汇总我们前期讨论与迭代的关键结论，并给出可执行的实施路径，便于后续协作与追踪。

## 1. 目标与原则
- 保持 GitHub Pages 现有发布流程与 Jekyll 站点结构不变。
- 采用混合架构：静态页 + Vercel Functions 提供搜索/建议/统计等动态能力。
- 前端 UI 保留原有卡片美学与交互动效，优化“规模增大后的可用性与性能”。

## 2. 架构与部署
- 托管：
  - 静态页面：GitHub Pages（Jekyll 构建产物 `_site`）。
  - 动态 API：Vercel Functions（Node 18/20，Git 集成自动部署）。
- 推荐部署（方案A，已采用）：Vercel Git 集成
  - `Root Directory`: 仓库即 `papercache`（如项目在子目录，再设）
  - `Build Command`: `JEKYLL_ENV=production bundle exec jekyll build`
  - `Output Directory`: `_site`
  - 控制台配置 Functions 运行时为默认 Node，不添加旧式 runtime。
- 备用部署（方案B，可选）：GitHub Actions 驱动 `vercel build/deploy`（通过 `VERCEL_TOKEN` 等 Secret）。

## 3. 数据与索引
- 页面注入精简数据 `window.PAPERCACHE_POSTS`（title/url/excerpt/tags/categories），来源 `site.posts`。
- 前端本地回退：当后端 API 不可用或返回空结果时，按“标题+摘要+标签+分类”做大小写不敏感、空格分词 AND 匹配。
- 目标方案：构建期生成 Lunr.js 索引（字段加权，标题权重大于摘要/标签），函数与前端共用索引提升精确度与性能。

## 4. API 设计（Vercel Functions）
- `POST /api/search`：入参 `{ query, filters? }`，出参 `{ results: [{ title, url, excerpt, tags, categories }] }`。
- `POST /api/suggestions`：入参 `{ partialQuery }`，出参 `{ suggestions: string[] }`。
- `GET /api/stats`：出参 `{ totalPapers, totalCategories, totalTags }`。

## 5. 前端交互与页面信息架构
- 搜索优先 + 分类浏览（保持原卡片美学）：
  - 顶部搜索输入与热门建议；
  - “快速浏览”展示核心分类；
  - “浏览所有论文”与分类卡片均以卡片网格渲染列表；
  - 结果列表保留缩略图、标签、摘要与动效。
- 侧边旧导航：在搜索优先布局中隐藏，以减轻视觉负担；保留“返回原版浏览页”的入口（可选）。
- 标签显示策略：
  - 优先取文章首个标签；
  - 无标签回退为最后一级分类；
  - 含 `arXiv`（大小写不敏感）默认显示 `arXiv` 并应用绿色渐变样式。
- 缩略图：
  - 从 `_data/thumbnails_by_path.yml` 映射；
  - 统一 URL 归一化（末尾 `/`、缺 `.html`、带 base path 均可匹配）；
  - 未命中使用占位图。

## 6. 性能与可用性
- 初始渲染快：仅显示搜索与“快速浏览”，列表按需加载。
- 结果渲染后自动滚至列表起始位置，避免用户看不到卡片。
- 后续优化：
  - 预构建 Lunr 索引并开启 HTTP 缓存；
  - 结果卡片图片 `loading=lazy`；
  - 批量/增量渲染（虚拟列表、分页或分区显示）。

## 7. 待完成与问题清单（Working List）
1) Lunr 索引构建脚本（构建期生成 json，大小与字段权重评估）
2) 云函数 `/api/search` 接入构建期索引，增加字段权重匹配与高亮（可选）
3) 前端搜索统一 `API_BASE`（本地/预览/生产可切换）
4) 卡片缩略图“全覆盖”核对：
   - 统计无图链接；
   - 扩展归一化策略（含 `/index.html` 与多级 basePath）；
5) 分类浏览体验：
   - “返回原版浏览页”入口（可选）；
   - 分类内搜索（local 过滤 + API 过滤）
6) RSS 加强：
   - 专题/标签 RSS；
   - 最新十篇 RSS；
7) 部署与回归：
   - Vercel 生产域 API 联调；
   - 站内 fetch 全量切换至 `API_BASE`；
   - E2E 烟囱流程（搜索→结果→详情）

## 8. 里程碑（Milestones）
- M1（本周）：
  - 搜索优先布局可用：搜索、浏览全部、按分类浏览，结果滚动可见。
  - 修复卡片缩略图覆盖率 ≥ 95%。
- M2（下周）：
  - 接入构建期 Lunr 索引与 `/api/search`；
  - 加权匹配与 UI 高亮；
  - 部署与回归（Vercel 生产）。
- M3：
  - RSS 增强；
  - 长期数据规模优化（分页/虚拟列表/分区加载方案落地）。

## 9. 约定与约束
- 不破坏现有 Jekyll 数据与发布流程；
- 所有新功能均保持“可回退、本地可跑、线上可观察”的工程标准；
- 最终 UI 与交互以“原有美学一致 + 大规模可用性提升”为准绳。

---
如需把该文件拆分为「架构说明」「前端计划」「后端计划」「运维与部署」四份文档，也可后续再细化。欢迎在 PR 中直接勾选与注释对应条目。



