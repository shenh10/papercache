#!/bin/bash

# 快速本地开发脚本 - 使用预构建的 _site 目录
# 这样可以获得接近生产环境的性能
# 使用方法: ./scripts/dev_fast.sh

set -e

echo "🚀 启动快速本地开发服务器（使用预构建文件）..."

# 检查是否在正确的目录
if [ ! -f "_config.yml" ]; then
    echo "❌ 错误：请在 papercache 根目录运行此脚本"
    exit 1
fi

# 检查 _site 目录是否存在
if [ ! -d "_site" ]; then
    echo "📦 _site 目录不存在，先构建站点..."
    bundle exec jekyll build --config _config.yml,_config_local.yml
fi

# 停止现有的 Jekyll 进程
echo "🛑 停止现有的 Jekyll 进程..."
pkill -f "jekyll serve" 2>/dev/null || true
sleep 2

# 使用预构建的 _site 目录启动服务器
# 使用 --skip-initial-build 跳过构建，直接使用现有 _site
echo "🌐 启动静态文件服务器..."
echo "📍 网站将在 http://localhost:4000/papercache 运行"
echo "💡 注意：修改文件后需要重新构建（运行: bundle exec jekyll build）"
echo ""

# 使用 Python 的简单 HTTP 服务器（比 Jekyll serve 快很多）
cd _site

# 检查 Python 是否可用
if command -v python3 &> /dev/null; then
    echo "✅ 使用 Python HTTP 服务器（更快）"
    python3 -m http.server 4000
elif command -v python &> /dev/null; then
    echo "✅ 使用 Python HTTP 服务器（更快）"
    python -m SimpleHTTPServer 4000
else
    echo "⚠️  Python 不可用，回退到 Jekyll serve"
    cd ..
    bundle exec jekyll serve --skip-initial-build --config _config.yml,_config_local.yml --host 0.0.0.0 --port 4000
fi

