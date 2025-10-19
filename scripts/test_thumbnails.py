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
    print("✅ 缩略图生成脚本存在")
    
    # 检查 _data 目录（必需）
    data_dir = pathlib.Path("_data")
    if not data_dir.exists():
        print("❌ 必要目录 _data 不存在")
        return False
    print("✅ _data 目录存在")
    
    # 检查是否有文章文件
    posts_dir = pathlib.Path("_posts")
    if not posts_dir.exists():
        print("❌ _posts 目录不存在")
        return False
    
    post_count = len(list(posts_dir.glob("*.html")))
    if post_count == 0:
        print("❌ 没有找到文章文件")
        return False
    print(f"✅ 找到 {post_count} 篇文章")
    
    # 检查 _site 目录（Jekyll 构建后才有，CI 环境中可能不存在）
    site_dir = pathlib.Path("_site")
    if not site_dir.exists():
        print("⚠️  _site 目录不存在（需要先运行 Jekyll 构建）")
        print("ℹ️  这在 CI 环境的构建前阶段是正常的")
    else:
        print("✅ _site 目录存在")
    
    # 检查依赖包
    print("🔍 检查 Python 依赖...")
    try:
        import yaml
        print("✅ PyYAML 已安装")
    except ImportError:
        print("❌ PyYAML 未安装")
        return False
    
    try:
        from bs4 import BeautifulSoup
        print("✅ BeautifulSoup4 已安装")
    except ImportError:
        print("❌ BeautifulSoup4 未安装")
        return False
    
    try:
        from PIL import Image
        print("✅ Pillow 已安装")
    except ImportError:
        print("❌ Pillow 未安装")
        return False
    
    try:
        import requests
        print("✅ requests 已安装")
    except ImportError:
        print("❌ requests 未安装")
        return False
    
    print("✅ 所有必要文件和依赖都已就绪")
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
