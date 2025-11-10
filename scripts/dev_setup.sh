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
mkdir -p assets/data
mkdir -p _data

# 检查 Jekyll 是否已安装
echo "🔍 检查 Jekyll 环境..."
if ! command -v bundle &> /dev/null; then
    echo "❌ 错误：未找到 bundle 命令，请先安装 Ruby 和 Bundler"
    exit 1
fi

# 加载 Supabase 配置
echo "🔐 加载 Supabase 配置..."
if [ -f "scripts/load-env-to-config.sh" ]; then
    # 检查是否存在 .env.local 文件
    if [ -f ".env.local" ]; then
        bash scripts/load-env-to-config.sh
        if [ $? -eq 0 ]; then
            echo "✅ Supabase 配置已加载"
        else
            echo "⚠️  警告：Supabase 配置加载失败，将使用空配置"
        fi
    else
        echo "⚠️  警告：未找到 .env.local 文件，Supabase 功能可能不可用"
        echo "   提示：创建 .env.local 文件并添加 SUPABASE_URL 和 SUPABASE_ANON_KEY"
    fi
else
    echo "⚠️  警告：找不到 scripts/load-env-to-config.sh"
fi

# 安装依赖
echo "📦 安装 Jekyll 依赖..."
bundle install

# 先构建 Jekyll 站点（生成 _site 目录，包括 papers 和 slides）
echo "🏗️ 构建 Jekyll 站点（包括 papers 和 slides）..."
bundle exec jekyll build --config _config.yml,_config_local.yml

# 检查 _site 目录是否成功生成
if [ ! -d "_site" ]; then
    echo "❌ 错误：_site 目录未生成，请检查 Jekyll 构建是否成功"
    exit 1
fi

# 生成缩略图（需要 _site 目录存在，会处理 papers 和 slides）
echo "🖼️ 生成缩略图（包括 papers 和 slides）..."
if [ -f "scripts/gen_thumbs.py" ]; then
    # 检查必要的 Python 依赖
    if ! python3 -c "import PIL, yaml" 2>/dev/null; then
        echo "📦 安装 Python 依赖（Pillow 和 PyYAML）..."
        pip3 install Pillow PyYAML 2>/dev/null || echo "⚠️  警告：无法自动安装依赖，请手动安装: pip install Pillow PyYAML"
    fi
    
    python3 scripts/gen_thumbs.py --size 960x600 --thumbnails-out assets/data --mapping-out _data
    
    # 检查映射文件是否生成
    if [ ! -f "_data/thumbnails_by_path.yml" ]; then
        echo "⚠️  警告：缩略图映射文件未生成"
    else
        # 复制缩略图映射文件到assets/data/供客户端使用
        cp _data/thumbnails_by_path.yml assets/data/thumbnails_by_path.yml
        
        # 统计生成的缩略图数量
        THUMB_COUNT=$(grep -c "^/" _data/thumbnails_by_path.yml 2>/dev/null || echo "0")
        SLIDES_COUNT=$(grep -c "/slides/" _data/thumbnails_by_path.yml 2>/dev/null || echo "0")
        echo "✅ 缩略图生成完成"
        echo "   - 总计: $THUMB_COUNT 个缩略图"
        echo "   - 其中演示文稿: $SLIDES_COUNT 个"
    fi
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
    # 复制摘要映射文件到assets/data/供客户端使用
    cp _data/excerpts.json assets/data/excerpts.json
    echo "✅ 摘要映射生成完成"
else
    echo "❌ 错误：找不到 scripts/generate_excerpts.py"
    exit 1
fi

# 启动 Jekyll 开发服务器
echo "🌐 启动 Jekyll 开发服务器..."
echo "📍 网站将在 http://localhost:4000/papercache 运行"
echo "📍 RSS Feed: http://127.0.0.1:4000/papercache/feed.xml"
echo "🔄 使用 Ctrl+C 停止服务器"
echo ""

bundle exec jekyll serve --incremental --livereload --host 0.0.0.0 --config _config.yml,_config_local.yml