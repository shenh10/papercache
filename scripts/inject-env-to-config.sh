#!/bin/bash
# 从环境变量注入配置到 _config.yml
# 使用方法: ./scripts/inject-env-to-config.sh

CONFIG_FILE="_config.yml"
TEMP_CONFIG="_config.temp.yml"

# 检查必需的环境变量
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
    echo "⚠️  警告: SUPABASE_URL 或 SUPABASE_ANON_KEY 环境变量未设置"
    echo "   将在 _config.yml 中使用空值（用户系统将被禁用）"
    exit 0
fi

# 备份原文件
if [ -f "$CONFIG_FILE" ]; then
    cp "$CONFIG_FILE" "$CONFIG_FILE.bak"
fi

# 创建临时配置文件
cat > "$TEMP_CONFIG" <<EOF
# Supabase 配置 - 从环境变量注入（自动生成，请勿手动编辑）
supabase:
  url: "$SUPABASE_URL"
  anon_key: "$SUPABASE_ANON_KEY"
  enabled: true
EOF

# 使用 Python 脚本合并配置（更可靠）
python3 <<PYTHON_SCRIPT
import yaml
import sys
import os

# 读取原始配置
with open('$CONFIG_FILE', 'r', encoding='utf-8') as f:
    config = yaml.safe_load(f) or {}

# 读取临时配置
with open('$TEMP_CONFIG', 'r', encoding='utf-8') as f:
    temp_config = yaml.safe_load(f) or {}

# 合并配置
config['supabase'] = temp_config.get('supabase', {})

# 写回配置文件
with open('$CONFIG_FILE', 'w', encoding='utf-8') as f:
    yaml.dump(config, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
    
    # 手动添加注释（因为 yaml.dump 不保留注释）
    with open('$CONFIG_FILE', 'r', encoding='utf-8') as rf:
        content = rf.read()
    
    # 在 supabase 配置前添加注释
    supabase_section = """# Supabase 配置 - 用户管理系统
# 注意：这些值从环境变量注入，不要在代码中硬编码
# 在生产环境中，通过Vercel或GitHub Actions的环境变量设置
"""
    
    # 替换 supabase 部分
    import re
    pattern = r'^supabase:'
    replacement = supabase_section + 'supabase:'
    content = re.sub(pattern, replacement, content, flags=re.MULTILINE)
    
    with open('$CONFIG_FILE', 'w', encoding='utf-8') as wf:
        wf.write(content)

print("✅ 已从环境变量注入 Supabase 配置到 _config.yml")
PYTHON_SCRIPT

# 清理临时文件
rm -f "$TEMP_CONFIG"

echo "配置完成！"
echo "  SUPABASE_URL: $SUPABASE_URL"
echo "  SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY:0:20}..."



