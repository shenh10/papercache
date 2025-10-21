#!/bin/bash

# Jekyll 内存监控脚本
# 用于监控和自动重启 Jekyll 进程以防止内存泄漏

MEMORY_LIMIT_MB=1500  # 内存限制（MB）
CHECK_INTERVAL=30     # 检查间隔（秒）
LOG_FILE="jekyll_memory.log"

echo "🔍 开始监控 Jekyll 内存使用..."
echo "内存限制: ${MEMORY_LIMIT_MB}MB"
echo "检查间隔: ${CHECK_INTERVAL}秒"
echo "日志文件: ${LOG_FILE}"
echo ""

while true; do
    # 查找 Jekyll 进程
    JEKYLL_PID=$(ps aux | grep "jekyll serve" | grep -v grep | awk '{print $2}' | head -1)
    
    if [ -z "$JEKYLL_PID" ]; then
        echo "$(date): Jekyll 进程未运行" >> "$LOG_FILE"
        sleep $CHECK_INTERVAL
        continue
    fi
    
    # 获取内存使用情况
    MEMORY_MB=$(ps -o rss= -p $JEKYLL_PID | awk '{print int($1/1024)}')
    
    echo "$(date): Jekyll PID $JEKYLL_PID 内存使用: ${MEMORY_MB}MB"
    
    # 检查是否超过内存限制
    if [ "$MEMORY_MB" -gt "$MEMORY_LIMIT_MB" ]; then
        echo "⚠️  内存使用超过限制 (${MEMORY_MB}MB > ${MEMORY_LIMIT_MB}MB)"
        echo "$(date): 内存超限，重启 Jekyll 进程 (${MEMORY_MB}MB > ${MEMORY_LIMIT_MB}MB)" >> "$LOG_FILE"
        
        # 杀死当前 Jekyll 进程
        kill $JEKYLL_PID
        sleep 5
        
        # 重新启动 Jekyll
        echo "🔄 重新启动 Jekyll..."
        bundle exec jekyll serve --host 0.0.0.0 --port 4000 --detach --incremental
        echo "$(date): Jekyll 进程已重启" >> "$LOG_FILE"
    fi
    
    sleep $CHECK_INTERVAL
done

