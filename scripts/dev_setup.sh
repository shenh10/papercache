#!/bin/bash

# 本地开发环境设置脚本
# 用于生成缩略图、摘要映射和启动 Jekyll 开发服务器

set -e

echo "🚀 启动本地开发环境..."

# 检查是否在正确的目录
if [ ! -f "_config.yml" ]; then
    echo "❌ 错误：请在 papercache 根目录运行此脚本"
    exit 1
fi

# 创建必要的目录
echo "📁 创建必要的目录..."
mkdir -p assets/images/thumbs
mkdir -p _data

# 生成缩略图
echo "🖼️ 生成缩略图..."
if [ -f "scripts/gen_thumbs.py" ]; then
    python3 scripts/gen_thumbs.py --size 320x200 --out assets/images/thumbs
    echo "✅ 缩略图生成完成"
else
    echo "❌ 错误：找不到 scripts/gen_thumbs.py"
    exit 1
fi

# 生成摘要映射
echo "📝 生成摘要映射..."
if [ -f "scripts/generate_excerpts.py" ]; then
    # 安装必要的Python依赖
    if ! python3 -c "import bs4" 2>/dev/null; then
        echo "📦 安装 BeautifulSoup4..."
        pip3 install beautifulsoup4
    fi
    
    python3 scripts/generate_excerpts.py
    echo "✅ 摘要映射生成完成"
else
    echo "❌ 错误：找不到 scripts/generate_excerpts.py"
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
echo "📍 网站将在 http://localhost:4000 运行"
echo "🔄 使用 Ctrl+C 停止服务器"
echo ""

bundle exec jekyll serve --incremental --livereload