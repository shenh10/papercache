q# 本地开发脚本

## 快速开始

### 1. 一键启动开发环境
```bash
./scripts/dev_setup.sh
```
这个脚本会：
- 自动生成缩略图
- 安装 Jekyll 依赖
- 启动开发服务器（http://localhost:4000）

### 2. 仅生成缩略图
```bash
./scripts/gen_thumbs_local.sh
```
当你添加了新文章或修改了现有文章时，运行此脚本重新生成缩略图。

## 注意事项

- 缩略图文件（`assets/images/thumbs/` 和 `_data/thumbnails_by_path.yml`）不会被 Git 管理
- 这些文件会在 CI 中自动生成，所以不需要提交到仓库
- 本地开发时需要手动运行脚本生成缩略图

## 故障排除

如果遇到问题：
1. 确保在 `papercache` 根目录运行脚本
2. 检查 Python 依赖：`pip install beautifulsoup4 PyYAML lxml Pillow requests`
3. 检查 Ruby 环境：`bundle install`

