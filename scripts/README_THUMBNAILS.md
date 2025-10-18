# 缩略图自动生成系统

## 概述

这个系统在Jekyll构建过程中自动生成文章缩略图，解决了collection页面内存消耗过大的问题。

## 工作流程

### 1. 触发条件
- 当deepnotes仓库有HTML文件变更时，会触发`deploy_to_papercache.yml`工作流
- 该工作流会将新内容同步到papercache仓库
- 然后触发papercache的`build_and_deploy.yml`工作流

### 2. 缩略图生成流程
在`build_and_deploy.yml`中，缩略图生成在Jekyll构建之前进行：

1. **设置Python环境** - 安装Python 3.11
2. **安装依赖** - 安装Pillow、PyYAML、beautifulsoup4、requests
3. **环境测试** - 运行`test_thumbnails.py`验证环境
4. **生成缩略图** - 运行`gen_thumbs.py`脚本
5. **构建Jekyll站点** - 使用生成的缩略图构建站点
6. **压缩资源** - 包括缩略图文件的压缩
7. **部署到GitHub Pages**

## 脚本说明

### `gen_thumbs.py`
- 扫描Jekyll构建后的页面
- 使用与JavaScript相同的逻辑找到合适的头图
- 支持`data:` URL解码和处理
- 生成320x200像素的固定尺寸缩略图
- 为没有图片的文章生成ASCII风格的占位符

### `test_thumbnails.py`
- 验证缩略图生成环境是否正常
- 检查必要文件和目录是否存在
- 确保有文章文件可供处理

## 输出文件

### 缩略图文件
- 位置：`assets/images/thumbs/`
- 格式：JPG
- 命名：使用文章URL的哈希值
- 大小：320x200像素

### 映射文件
- 位置：`_data/thumbnails_by_path.yml`
- 内容：文章URL到缩略图路径的映射

## 性能优化

- **内存优化**：从20GB降低到几乎为0
- **加载速度**：大幅提升（不再需要解析完整的文章HTML）
- **文件压缩**：缩略图文件也会被gzip压缩
- **缓存机制**：缩略图在构建时生成，运行时直接使用

## 本地开发

### 快速设置
使用提供的脚本快速设置本地开发环境：

```bash
# 在papercache根目录运行
./scripts/dev_setup.sh
```

### 手动运行
如果需要手动生成缩略图：

```bash
# 安装依赖
pip install Pillow PyYAML beautifulsoup4 requests

# 生成缩略图
python scripts/gen_thumbs.py --root . --out assets/images/thumbs --size 320x200 --placeholder

# 测试环境
python scripts/test_thumbnails.py
```

## Git管理策略

**缩略图文件不加入Git管理**，原因：
- 保持Git仓库轻量（避免7.2MB的二进制文件）
- 每次部署时自动生成最新缩略图
- 避免二进制文件的版本控制问题

如果需要本地开发，请使用上述脚本生成缩略图。

## 故障排除

如果缩略图生成失败，检查：
1. Python环境是否正确设置
2. 依赖包是否正确安装
3. 是否有文章文件存在
4. `_site`目录是否已构建
5. `collection_structure.yml`是否存在
