#!/usr/bin/env python3
"""
Local Sync Watcher for PaperCache
实时监控 deepnotes 目录的变化并自动同步到 papercache
"""
import os
import sys
import time
import subprocess
import logging
from pathlib import Path
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import argparse

# 设置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('sync_watcher.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class DeepNotesSyncHandler(FileSystemEventHandler):
    def __init__(self, deepnotes_dir, papercache_dir):
        self.deepnotes_dir = Path(deepnotes_dir)
        self.papercache_dir = Path(papercache_dir)
        self.last_sync_time = 0
        self.sync_cooldown = 2  # 2秒冷却时间，避免频繁同步
        
    def on_created(self, event):
        if not event.is_directory and event.src_path.endswith('.html'):
            logger.info(f"检测到新文件: {event.src_path}")
            self.schedule_sync()
    
    def on_modified(self, event):
        if not event.is_directory and event.src_path.endswith('.html'):
            logger.info(f"检测到文件修改: {event.src_path}")
            self.schedule_sync()
    
    def on_deleted(self, event):
        if not event.is_directory and event.src_path.endswith('.html'):
            logger.info(f"检测到文件删除: {event.src_path}")
            self.schedule_sync()
    
    def on_moved(self, event):
        if not event.is_directory and (event.src_path.endswith('.html') or event.dest_path.endswith('.html')):
            logger.info(f"检测到文件移动: {event.src_path} -> {event.dest_path}")
            self.schedule_sync()
    
    def schedule_sync(self):
        """安排同步任务，避免频繁触发"""
        current_time = time.time()
        if current_time - self.last_sync_time > self.sync_cooldown:
            self.last_sync_time = current_time
            # 延迟执行，避免文件还在写入中
            time.sleep(1)
            self.sync_to_papercache()
    
    def sync_to_papercache(self):
        """同步到 papercache"""
        try:
            logger.info("开始同步到 PaperCache...")
            
            # 1. 运行转换脚本
            converter_script = self.deepnotes_dir / "scripts" / "html_to_jekyll_converter.py"
            if converter_script.exists():
                logger.info("运行 HTML 到 Jekyll 转换...")
                result = subprocess.run([
                    sys.executable, str(converter_script),
                    str(self.deepnotes_dir),
                    str(self.deepnotes_dir / "jekyll_output")
                ], capture_output=True, text=True, cwd=self.deepnotes_dir)
                
                if result.returncode == 0:
                    logger.info("转换完成")
                else:
                    logger.error(f"转换失败: {result.stderr}")
                    return
            else:
                logger.error(f"转换脚本不存在: {converter_script}")
                return
            
            # 2. 复制转换后的文件到 papercache
            jekyll_output_posts = self.deepnotes_dir / "jekyll_output" / "_posts"
            papercache_posts = self.papercache_dir / "_posts"
            
            if jekyll_output_posts.exists():
                # 确保目标目录存在
                papercache_posts.mkdir(parents=True, exist_ok=True)
                
                # 复制所有文件
                for post_file in jekyll_output_posts.glob("*.html"):
                    target_file = papercache_posts / post_file.name
                    with open(post_file, 'r', encoding='utf-8') as src:
                        with open(target_file, 'w', encoding='utf-8') as dst:
                            dst.write(src.read())
                    logger.info(f"同步文件: {post_file.name}")
            
            # 3. 复制 collection_structure.yml
            structure_file = self.deepnotes_dir / "jekyll_output" / "_data" / "collection_structure.yml"
            if structure_file.exists():
                target_structure = self.papercache_dir / "_data" / "collection_structure.yml"
                target_structure.parent.mkdir(parents=True, exist_ok=True)
                with open(structure_file, 'r', encoding='utf-8') as src:
                    with open(target_structure, 'w', encoding='utf-8') as dst:
                        dst.write(src.read())
                logger.info("同步 collection_structure.yml")
            
            # 4. 重新构建 Jekyll 站点
            logger.info("重新构建 Jekyll 站点...")
            result = subprocess.run(
                ["bundle", "exec", "jekyll", "build"],
                capture_output=True, text=True, cwd=self.papercache_dir
            )
            
            if result.returncode == 0:
                logger.info("✅ 同步完成！Jekyll 站点已重新构建")
            else:
                logger.error(f"Jekyll 构建失败: {result.stderr}")
                
        except Exception as e:
            logger.error(f"同步过程中出错: {e}")

def main():
    parser = argparse.ArgumentParser(description='监控 deepnotes 目录并自动同步到 papercache')
    parser.add_argument('--deepnotes-dir', default='../deepnotes', 
                       help='deepnotes 目录路径 (默认: ../deepnotes)')
    parser.add_argument('--papercache-dir', default='.', 
                       help='papercache 目录路径 (默认: 当前目录)')
    parser.add_argument('--one-time', action='store_true',
                       help='只同步一次，不持续监控')
    
    args = parser.parse_args()
    
    deepnotes_dir = Path(args.deepnotes_dir).resolve()
    papercache_dir = Path(args.papercache_dir).resolve()
    
    if not deepnotes_dir.exists():
        logger.error(f"deepnotes 目录不存在: {deepnotes_dir}")
        sys.exit(1)
    
    if not papercache_dir.exists():
        logger.error(f"papercache 目录不存在: {papercache_dir}")
        sys.exit(1)
    
    logger.info(f"监控目录: {deepnotes_dir}")
    logger.info(f"目标目录: {papercache_dir}")
    
    if args.one_time:
        # 只同步一次
        handler = DeepNotesSyncHandler(deepnotes_dir, papercache_dir)
        handler.sync_to_papercache()
        return
    
    # 持续监控
    event_handler = DeepNotesSyncHandler(deepnotes_dir, papercache_dir)
    observer = Observer()
    observer.schedule(event_handler, str(deepnotes_dir), recursive=True)
    
    logger.info("开始监控 deepnotes 目录... (按 Ctrl+C 停止)")
    
    try:
        observer.start()
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("停止监控...")
        observer.stop()
    
    observer.join()

if __name__ == '__main__':
    main()



