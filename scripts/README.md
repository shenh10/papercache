# PaperCache 同步脚本

这个目录包含了用于将 `deepnotes` 中的 HTML 文件自动同步到 `papercache` 的脚本。

## 脚本说明

### 1. `sync.sh` - 手动同步脚本

最简单的同步方式，手动运行一次同步。

**使用方法：**
```bash
# 在 papercache 目录下运行
./scripts/sync.sh

# 或者指定目录
./scripts/sync.sh -d /path/to/deepnotes -p /path/to/papercache

# 只同步，不构建 Jekyll 站点
./scripts/sync.sh --no-build
```

**选项：**
- `-h, --help`: 显示帮助信息
- `-d, --deepnotes DIR`: 指定 deepnotes 目录 (默认: ../deepnotes)
- `-p, --papercache DIR`: 指定 papercache 目录 (默认: 当前目录)
- `--no-build`: 跳过 Jekyll 构建

### 2. `local_sync_watcher.py` - 实时监控脚本

持续监控 `deepnotes` 目录的变化，自动同步到 `papercache`。

**安装依赖：**
```bash
pip install watchdog
```

**使用方法：**
```bash
# 在 papercache 目录下运行
python scripts/local_sync_watcher.py

# 只同步一次，不持续监控
python scripts/local_sync_watcher.py --one-time

# 指定目录
python scripts/local_sync_watcher.py --deepnotes-dir /path/to/deepnotes --papercache-dir /path/to/papercache
```

**选项：**
- `--deepnotes-dir`: deepnotes 目录路径 (默认: ../deepnotes)
- `--papercache-dir`: papercache 目录路径 (默认: 当前目录)
- `--one-time`: 只同步一次，不持续监控

## 工作流程

1. **监控变化**: 检测 `deepnotes` 目录中 HTML 文件的变化
2. **转换文件**: 使用 `html_to_jekyll_converter.py` 将 HTML 转换为 Jekyll 格式
3. **同步文件**: 将转换后的文件复制到 `papercache/_posts/`
4. **更新结构**: 同步 `collection_structure.yml` 文件
5. **重新构建**: 重新构建 Jekyll 站点

## 使用场景

### 场景 1: 手动同步
当您在 `deepnotes` 中添加或修改了 HTML 文件后，手动运行同步：

```bash
cd papercache
./scripts/sync.sh
```

### 场景 2: 实时监控
在开发过程中，启动实时监控，自动同步变化：

```bash
cd papercache
python scripts/local_sync_watcher.py
```

然后在另一个终端启动 Jekyll 服务器：

```bash
cd papercache
bundle exec jekyll serve --host 0.0.0.0 --port 4000
```

### 场景 3: 一次性同步
只同步一次，不持续监控：

```bash
cd papercache
python scripts/local_sync_watcher.py --one-time
```

## 注意事项

1. **依赖要求**: 
   - Python 3.6+
   - `watchdog` 库 (仅实时监控需要)
   - `bundle` 和 Jekyll (用于构建)

2. **目录结构**: 
   - 脚本假设 `deepnotes` 和 `papercache` 在同一父目录下
   - 如果目录结构不同，请使用 `-d` 和 `-p` 参数指定

3. **文件权限**: 
   - 确保脚本有执行权限：`chmod +x scripts/sync.sh`

4. **日志文件**: 
   - 实时监控脚本会生成 `sync_watcher.log` 日志文件

## 故障排除

### 问题 1: 转换脚本不存在
确保 `deepnotes/scripts/html_to_jekyll_converter.py` 文件存在。

### 问题 2: 权限错误
确保脚本有执行权限：
```bash
chmod +x scripts/sync.sh
```

### 问题 3: Python 依赖缺失
安装必要的 Python 包：
```bash
pip install watchdog beautifulsoup4 PyYAML lxml
```

### 问题 4: Jekyll 构建失败
检查 Jekyll 配置和依赖：
```bash
cd papercache
bundle install
bundle exec jekyll build
```

## 与 GitHub Actions 的关系

这些本地脚本与 GitHub Actions 工作流 (`deploy_to_papercache.yml`) 功能类似，但适用于本地开发：

- **GitHub Actions**: 在推送代码时自动触发，适用于生产环境
- **本地脚本**: 在本地开发时使用，提供更快的反馈循环
