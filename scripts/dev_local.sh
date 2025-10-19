#!/bin/bash

# 本地开发脚本 - 包含slides页面
# 使用方法: ./scripts/dev_local.sh

echo "🚀 启动本地开发服务器 (包含slides页面)..."

# 检查是否在正确的目录
if [ ! -f "_config.yml" ]; then
    echo "❌ 错误: 请在papercache根目录下运行此脚本"
    exit 1
fi

# 停止现有的Jekyll进程
echo "🛑 停止现有的Jekyll进程..."
pkill -f jekyll 2>/dev/null || true

# 等待端口释放
sleep 2

# 构建并启动本地开发服务器
echo "🔨 构建并启动本地开发服务器..."
bundle exec jekyll serve --config _config.yml,_config_local.yml --host 0.0.0.0 --port 4000 --livereload

echo "✅ 本地开发服务器已启动!"
echo "📱 访问地址: http://localhost:4000/papercache/"
echo "📊 Slides页面: http://localhost:4000/papercache/slides/"
