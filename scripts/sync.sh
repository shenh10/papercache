#!/bin/bash

# PaperCache 同步脚本
# 将 deepnotes 中的 HTML 文件同步到 papercache

set -e

# 配置
DEEPNOTES_DIR="../deepnotes"
PAPERCACHE_DIR="."
JEKYLL_OUTPUT_DIR="jekyll_output"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查目录是否存在
check_directories() {
    if [ ! -d "$DEEPNOTES_DIR" ]; then
        log_error "deepnotes 目录不存在: $DEEPNOTES_DIR"
        exit 1
    fi
    
    if [ ! -d "$PAPERCACHE_DIR" ]; then
        log_error "papercache 目录不存在: $PAPERCACHE_DIR"
        exit 1
    fi
}

# 运行转换脚本
run_converter() {
    log_info "运行 HTML 到 Jekyll 转换..."
    
    local converter_script="$DEEPNOTES_DIR/scripts/html_to_jekyll_converter.py"
    
    if [ ! -f "$converter_script" ]; then
        log_error "转换脚本不存在: $converter_script"
        exit 1
    fi
    
    cd "$DEEPNOTES_DIR"
    python3 "$converter_script" . "$JEKYLL_OUTPUT_DIR"
    cd - > /dev/null
    
    log_success "转换完成"
}

# 同步文件到 papercache
sync_files() {
    log_info "同步文件到 PaperCache..."
    
    local jekyll_posts="$DEEPNOTES_DIR/$JEKYLL_OUTPUT_DIR/_posts"
    local papercache_posts="$PAPERCACHE_DIR/_posts"
    
    if [ ! -d "$jekyll_posts" ]; then
        log_error "转换后的文件目录不存在: $jekyll_posts"
        exit 1
    fi
    
    # 创建目标目录
    mkdir -p "$papercache_posts"
    
    # 复制所有文章文件
    if [ -d "$jekyll_posts" ]; then
        cp -r "$jekyll_posts"/* "$papercache_posts/"
        log_success "文章文件同步完成"
    fi
    
    # 复制 collection_structure.yml
    local structure_file="$DEEPNOTES_DIR/$JEKYLL_OUTPUT_DIR/_data/collection_structure.yml"
    if [ -f "$structure_file" ]; then
        mkdir -p "$PAPERCACHE_DIR/_data"
        cp "$structure_file" "$PAPERCACHE_DIR/_data/"
        log_success "collection_structure.yml 同步完成"
    fi
}

# 构建 Jekyll 站点
build_jekyll() {
    log_info "重新构建 Jekyll 站点..."
    
    cd "$PAPERCACHE_DIR"
    
    if command -v bundle &> /dev/null; then
        bundle exec jekyll build
        log_success "Jekyll 站点构建完成"
    else
        log_warning "bundle 未安装，跳过 Jekyll 构建"
    fi
    
    cd - > /dev/null
}

# 显示帮助信息
show_help() {
    echo "PaperCache 同步脚本"
    echo ""
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  -h, --help     显示此帮助信息"
    echo "  -d, --deepnotes DIR  指定 deepnotes 目录 (默认: ../deepnotes)"
    echo "  -p, --papercache DIR 指定 papercache 目录 (默认: 当前目录)"
    echo "  --no-build     跳过 Jekyll 构建"
    echo ""
    echo "示例:"
    echo "  $0                    # 使用默认配置同步"
    echo "  $0 --no-build         # 同步但不构建"
    echo "  $0 -d /path/to/deepnotes -p /path/to/papercache"
}

# 主函数
main() {
    local skip_build=false
    
    # 解析命令行参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -d|--deepnotes)
                DEEPNOTES_DIR="$2"
                shift 2
                ;;
            -p|--papercache)
                PAPERCACHE_DIR="$2"
                shift 2
                ;;
            --no-build)
                skip_build=true
                shift
                ;;
            *)
                log_error "未知参数: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    log_info "开始同步..."
    log_info "deepnotes 目录: $DEEPNOTES_DIR"
    log_info "papercache 目录: $PAPERCACHE_DIR"
    
    # 检查目录
    check_directories
    
    # 运行转换
    run_converter
    
    # 同步文件
    sync_files
    
    # 构建 Jekyll 站点
    if [ "$skip_build" = false ]; then
        build_jekyll
    fi
    
    log_success "✅ 同步完成！"
}

# 运行主函数
main "$@"
