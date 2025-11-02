#!/bin/bash
# 从 .env.local 读取 Supabase 配置并更新 _config_local.yml
# 使用方法: ./scripts/load-env-to-config.sh

ENV_FILE=".env.local"
CONFIG_FILE="_config_local.yml"

if [ ! -f "$ENV_FILE" ]; then
    echo "错误: .env.local 文件不存在"
    exit 1
fi

# 从 .env.local 读取环境变量
SUPABASE_URL=$(grep "^SUPABASE_URL=" "$ENV_FILE" | cut -d '=' -f2- | tr -d '"' | tr -d "'")
SUPABASE_ANON_KEY=$(grep "^SUPABASE_ANON_KEY=" "$ENV_FILE" | cut -d '=' -f2- | tr -d '"' | tr -d "'")

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
    echo "错误: 在 .env.local 中未找到 SUPABASE_URL 或 SUPABASE_ANON_KEY"
    exit 1
fi

# 备份原文件
cp "$CONFIG_FILE" "$CONFIG_FILE.bak"

# 使用 sed 更新配置（macOS 和 Linux 兼容）
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s|url: \".*\"|url: \"$SUPABASE_URL\"|" "$CONFIG_FILE"
    sed -i '' "s|anon_key: \".*\"|anon_key: \"$SUPABASE_ANON_KEY\"|" "$CONFIG_FILE"
else
    # Linux
    sed -i "s|url: \".*\"|url: \"$SUPABASE_URL\"|" "$CONFIG_FILE"
    sed -i "s|anon_key: \".*\"|anon_key: \"$SUPABASE_ANON_KEY\"|" "$CONFIG_FILE"
fi

echo "✅ 已更新 _config_local.yml"
echo "   SUPABASE_URL: $SUPABASE_URL"
echo "   SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY:0:20}..."
echo ""
echo "备份文件保存在: $CONFIG_FILE.bak"

