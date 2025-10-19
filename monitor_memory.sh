#!/bin/bash

# Jekyll内存监控脚本
echo "开始监控Jekyll内存使用情况..."

while true; do
    # 查找Jekyll进程
    JEKYLL_PID=$(ps aux | grep "jekyll serve" | grep -v grep | awk '{print $2}')
    
    if [ ! -z "$JEKYLL_PID" ]; then
        # 获取内存使用情况
        MEMORY_USAGE=$(ps -o rss= -p $JEKYLL_PID)
        MEMORY_MB=$((MEMORY_USAGE / 1024))
        MEMORY_GB=$((MEMORY_MB / 1024))
        
        echo "$(date): Jekyll PID $JEKYLL_PID 内存使用: ${MEMORY_MB}MB (${MEMORY_GB}GB)"
        
        # 如果内存使用超过2GB，发出警告
        if [ $MEMORY_MB -gt 2048 ]; then
            echo "⚠️  警告: Jekyll内存使用过高 (${MEMORY_MB}MB)"
        fi
        
        # 如果内存使用超过5GB，自动重启
        if [ $MEMORY_MB -gt 5120 ]; then
            echo "🚨 内存使用过高，自动重启Jekyll..."
            kill $JEKYLL_PID
            sleep 5
            echo "重启Jekyll..."
            bundle exec jekyll serve --config _config.yml &
        fi
    else
        echo "$(date): 未找到Jekyll进程"
    fi
    
    sleep 30  # 每30秒检查一次
done
