# 🖼️ 缩略图策略说明

## 策略选择：提交缩略图到 Git

本项目采用**将缩略图文件提交到 Git 仓库**的策略，而不是在每次构建时动态生成。

## 为什么选择这个策略？

### ✅ 优势

1. **可靠性**
   - 不依赖构建时的网络请求（某些图片可能是 data URI 或外部链接）
   - 避免因网络问题导致的构建失败
   - GitHub Pages 构建时间有限制，预生成可以节省时间

2. **性能**
   - 用户访问时直接加载已生成的缩略图
   - 构建速度更快（不需要重新处理图片）
   - 减少 GitHub Actions 的计算资源消耗

3. **确定性**
   - 缩略图是确定性的（同一篇文章总是生成相同的缩略图）
   - 便于版本控制和回滚
   - 可以在本地预览最终效果

4. **调试方便**
   - 可以直接查看生成的缩略图
   - 出问题时容易定位（是生成问题还是加载问题）

### ⚠️ 权衡

1. **仓库体积**
   - 当前 277 个缩略图文件，总大小约 3.7MB
   - 对于 Git 仓库来说可以接受（GitHub 单仓库限制 100GB）
   - 未来如果文章数量增长，可以考虑 Git LFS

2. **提交频率**
   - 每次新增/修改文章都会提交新的缩略图
   - Git 历史会记录这些变化
   - 可以通过 `.gitattributes` 标记为二进制文件避免 diff

## 工作流程

### 1. 本地开发
```bash
# 在 papercache 目录下生成缩略图
cd papercache
python3 scripts/gen_thumbs.py

# 生成的文件
# - _data/thumbnails_by_path.yml  (映射文件)
# - assets/images/thumbs/*.jpg    (缩略图文件)

# 🚀 增量更新特性
# - 脚本会自动检测已存在的缩略图，跳过不需要重新生成
# - 只生成新增或修改的文章的缩略图
# - 大幅提升运行速度，减少 Git 变更
```

### 2. CI/CD 自动化
```yaml
# deepnotes/.github/workflows/deploy_to_papercache.yml
- 转换 HTML → Jekyll 格式
- 同步到 papercache 仓库
- 生成缩略图（python3 scripts/gen_thumbs.py）
- 提交所有文件（包括缩略图）
```

### 3. GitHub Pages 构建
```yaml
# papercache/.github/workflows/deploy-pages.yml
- 重新生成缩略图（保险措施）
- Jekyll 构建
- 部署到 GitHub Pages
```

## 文件说明

### 生成的文件
- `_data/thumbnails_by_path.yml`: 文章路径 → 缩略图路径的映射
- `assets/images/thumbs/*.jpg`: 缩略图文件（JPEG 格式，最大宽度 400px）

### 临时文件（不提交）
- `.thumb_tmp/`: 下载图片时的临时缓存目录（已在 .gitignore 中）

## 备选方案

如果未来需要改变策略，可以考虑：

1. **Git LFS**
   - 适合大量大文件
   - 需要额外配置

2. **外部存储**
   - 使用 CDN（如 Cloudflare R2、AWS S3）
   - 需要额外的存储成本和配置

3. **构建时生成**
   - 从 `.gitignore` 中移除缩略图
   - 完全依赖 CI/CD 生成
   - 风险更高，但仓库更小

## 客户端回退机制

即使缩略图文件不存在，网站也能正常工作：

```javascript
// assets/js/card-enhancements.js
// 如果服务端缩略图不存在，客户端会：
1. 尝试从 HTML 中动态提取第一个合适的图片
2. 使用与 gen_thumbs.py 完全相同的规则
3. 最终使用 ASCII 艺术字兜底图片
```

## 相关文件

- `scripts/gen_thumbs.py`: 缩略图生成脚本
- `assets/js/card-enhancements.js`: 客户端动态生成逻辑
- `.gitignore`: Git 忽略规则
- `README.md`: 缩略图选择规则文档

