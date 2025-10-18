#!/bin/bash
# 本地开发环境设置脚本

echo "🚀 设置本地开发环境..."

# 检查是否在正确的目录
if [ ! -f "_config.yml" ]; then
    echo "❌ 请在papercache根目录运行此脚本"
    exit 1
fi

# 检查Python环境
if ! command -v python3 &> /dev/null; then
    echo "❌ 需要Python 3"
    exit 1
fi

# 安装Python依赖
echo "📦 安装Python依赖..."
pip3 install Pillow PyYAML beautifulsoup4 requests

# 检查是否有Jekyll构建
if [ ! -d "_site" ]; then
    echo "🔨 构建Jekyll站点..."
    bundle exec jekyll build
fi

# 生成缩略图
echo "🖼️ 生成缩略图..."
python3 scripts/gen_thumbs.py --root . --out assets/images/thumbs --size 320x200 --placeholder

echo "✅ 本地开发环境设置完成！"
echo "现在可以运行 'bundle exec jekyll serve' 启动本地服务器"
