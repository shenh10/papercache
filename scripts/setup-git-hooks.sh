#!/bin/bash
# 设置 Git hooks（防止误提交敏感信息）
# 使用方法: ./scripts/setup-git-hooks.sh

HOOKS_DIR=".git/hooks"
PRE_COMMIT_HOOK="$HOOKS_DIR/pre-commit"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ ! -d "$HOOKS_DIR" ]; then
    echo "错误: .git/hooks 目录不存在"
    echo "请确保在 Git 仓库根目录运行此脚本"
    exit 1
fi

# 复制 pre-commit hook
if [ -f "$REPO_ROOT/.git/hooks/pre-commit" ]; then
    echo "✅ Git pre-commit hook 已存在"
else
    # 如果 hooks 目录中的 pre-commit 不存在，创建它
    cat > "$PRE_COMMIT_HOOK" <<'EOF'
#!/bin/bash
# Git pre-commit hook: 检查是否包含敏感信息

CONFIG_LOCAL="_config_local.yml"
ERROR=0

# 检查 _config_local.yml 是否包含 Supabase URL（非空）
if [ -f "$CONFIG_LOCAL" ]; then
    # 检查是否包含真实的 Supabase URL（匹配 supabase.co 域名）
    if grep -q "supabase.co" "$CONFIG_LOCAL" 2>/dev/null; then
        echo "❌ 错误: _config_local.yml 包含敏感信息（Supabase URL）"
        echo ""
        echo "请先清除敏感信息："
        echo "  1. 编辑 _config_local.yml，将 url 和 anon_key 设置为空字符串"
        echo "  2. 或者运行: git checkout -- _config_local.yml"
        echo ""
        echo "真实配置应存储在 .env.local 中（不提交到Git）"
        echo "本地开发时使用脚本同步: ./scripts/load-env-to-config.sh"
        ERROR=1
    fi
    
    # 检查是否包含长的 token（可能是 anon_key）
    if grep -q "anon_key.*eyJ" "$CONFIG_LOCAL" 2>/dev/null; then
        echo "❌ 错误: _config_local.yml 包含敏感信息（Supabase anon_key）"
        echo ""
        echo "请先清除敏感信息，将 anon_key 设置为空字符串"
        ERROR=1
    fi
fi

# 检查 .env.local 是否被意外添加
if git diff --cached --name-only | grep -q "\.env\.local"; then
    echo "❌ 错误: 检测到 .env.local 文件被添加到暂存区"
    echo ""
    echo ".env.local 包含敏感信息，不应提交到 Git"
    echo "请运行: git reset HEAD .env.local"
    ERROR=1
fi

if [ $ERROR -eq 1 ]; then
    echo ""
    echo "提交已阻止。请修复上述问题后重新提交。"
    exit 1
fi

exit 0
EOF
    chmod +x "$PRE_COMMIT_HOOK"
    echo "✅ Git pre-commit hook 已安装"
fi

echo ""
echo "Git hooks 设置完成！"
echo ""
echo "现在每次提交前会自动检查："
echo "  - _config_local.yml 是否包含敏感信息"
echo "  - .env.local 是否被意外添加"
echo ""
echo "如果检测到敏感信息，提交会被阻止。"




