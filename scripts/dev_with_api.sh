#!/bin/bash

# 本地开发脚本 - 同时启动 Jekyll 和 Vercel Functions API
# 使用方法: ./scripts/dev_with_api.sh

set -e

echo "🚀 启动本地开发环境（包含 Vercel Functions API）..."

# 检查是否在正确的目录
if [ ! -f "_config.yml" ]; then
    echo "❌ 错误：请在 papercache 根目录运行此脚本"
    exit 1
fi

# 检查 Vercel CLI 是否已安装
if ! command -v vercel &> /dev/null; then
    echo "❌ 错误：未找到 vercel 命令"
    echo "请先安装 Vercel CLI: npm install -g vercel"
    exit 1
fi

# 检查 Node.js 依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装 Node.js 依赖..."
    npm install
fi

# 检查是否已登录 Vercel
if ! vercel whoami &> /dev/null; then
    echo "⚠️  未登录 Vercel，尝试登录..."
    vercel login
fi

# 检查是否已连接项目
if [ ! -f ".vercel/project.json" ]; then
    echo "⚠️  项目未连接到 Vercel，尝试连接..."
    echo "💡 如果提示选择范围，选择当前目录"
    vercel link
fi

# 停止现有的 Jekyll 和 Vercel 进程
echo "🛑 停止现有的服务器进程..."
pkill -f "jekyll serve" 2>/dev/null || true
pkill -f "vercel dev" 2>/dev/null || true
sleep 2

# 启动 Vercel Functions（在后台）
echo "🌐 启动 Vercel Functions API..."
echo "📍 API 将在 http://localhost:3000/api/search 运行"
vercel dev --listen 3000 &
VERCEL_PID=$!

# 等待 Vercel 启动
sleep 5

# 检查 Vercel 是否成功启动
if ! curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "⚠️  Vercel Functions 可能未正确启动，但继续尝试..."
fi

# 构建并启动 Jekyll（在前台）
echo "🏗️ 构建 Jekyll 站点..."
# 使用 _config_local.yml 确保本地也使用 /papercache baseurl
bundle exec jekyll build --config _config.yml,_config_local.yml

echo "📱 启动 Jekyll 开发服务器..."
echo "📍 网站将在 http://localhost:4000/papercache 运行"
echo "📍 API 端点: http://localhost:3000/api/search"
echo ""
echo "💡 注意：Jekyll 配置为使用 Vercel Functions API"
echo "🔄 使用 Ctrl+C 停止所有服务器"
echo ""

# 在前台运行 Jekyll，这样 Ctrl+C 可以同时停止
# 使用 _config_local.yml 确保本地也使用 /papercache baseurl
bundle exec jekyll serve --incremental --livereload --host 0.0.0.0 --port 4000 --config _config.yml,_config_local.yml

# 清理：当 Jekyll 停止时，也停止 Vercel
trap "kill $VERCEL_PID 2>/dev/null || true" EXIT

