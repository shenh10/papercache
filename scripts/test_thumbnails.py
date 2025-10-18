#!/usr/bin/env python3
"""
测试缩略图生成脚本的简单测试
用于验证CI环境中脚本能正常工作
"""

import sys
import pathlib
import subprocess

def test_thumbnail_generation():
    """测试缩略图生成"""
    print("🧪 测试缩略图生成脚本...")
    
    # 检查脚本是否存在
    script_path = pathlib.Path("scripts/gen_thumbs.py")
    if not script_path.exists():
        print("❌ 缩略图生成脚本不存在")
        return False
    
    # 检查必要的目录是否存在
    required_dirs = ["_site", "_data"]
    for dir_name in required_dirs:
        if not pathlib.Path(dir_name).exists():
            print(f"❌ 必要目录 {dir_name} 不存在")
            return False
    
    # 检查是否有文章文件
    posts_dir = pathlib.Path("_posts")
    if not posts_dir.exists() or not any(posts_dir.iterdir()):
        print("❌ 没有找到文章文件")
        return False
    
    print("✅ 所有必要文件和目录都存在")
    return True

def main():
    """主函数"""
    print("🚀 开始测试缩略图生成环境...")
    
    if test_thumbnail_generation():
        print("✅ 缩略图生成环境测试通过")
        sys.exit(0)
    else:
        print("❌ 缩略图生成环境测试失败")
        sys.exit(1)

if __name__ == "__main__":
    main()
