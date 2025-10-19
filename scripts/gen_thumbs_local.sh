#!/bin/bash

# 快速生成缩略图脚本（仅用于本地开发）

set -e

echo "🖼️ 生成本地缩略图..."

# 检查是否在正确的目录
if [ ! -f "_config.yml" ]; then
    echo "❌ 错误：请在 papercache 根目录运行此脚本"
    exit 1
fi

# 创建必要的目录
mkdir -p assets/images/thumbs
mkdir -p _data

# 生成缩略图
if [ -f "scripts/gen_thumbs.py" ]; then
    python3 scripts/gen_thumbs.py --size 320x200 --out assets/images/thumbs
    echo "✅ 缩略图生成完成！"
    echo "📊 生成了 $(ls -1 assets/images/thumbs/*.jpg 2>/dev/null | wc -l) 个缩略图文件"
else
    echo "❌ 错误：找不到 scripts/gen_thumbs.py"
    exit 1
fi
