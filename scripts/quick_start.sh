#!/bin/bash

# 快速启动脚本
# 跳过预生成步骤，直接启动 Jekyll 开发服务器

set -e

echo "🚀 快速启动 Jekyll 开发服务器..."

# 检查是否在正确的目录
if [ ! -f "_config.yml" ]; then
    echo "❌ 错误：请在 papercache 根目录运行此脚本"
    exit 1
fi

# 检查 Jekyll 是否已安装
echo "🔍 检查 Jekyll 环境..."
if ! command -v bundle &> /dev/null; then
    echo "❌ 错误：未找到 bundle 命令，请先安装 Ruby 和 Bundler"
    exit 1
fi

# 安装依赖
echo "📦 安装 Jekyll 依赖..."
bundle install

# 启动 Jekyll 开发服务器
echo "🌐 启动 Jekyll 开发服务器..."
echo "📍 网站将在 http://localhost:4000/papercache 运行"
echo "🔄 使用 Ctrl+C 停止服务器"
echo "💡 注意：缩略图和摘要将动态生成"
echo ""

# 使用 _config_local.yml 确保本地也使用 /papercache baseurl
bundle exec jekyll serve --incremental --livereload --config _config.yml,_config_local.yml
