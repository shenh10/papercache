#!/usr/bin/env python3
"""
同步 Supabase 数据库与论文文章的一致性
- 扫描 _posts/ 目录获取所有有效文章 URL
- 清理 Supabase 中的无效记录（指向已删除文章的收藏和点击统计）
"""

import os
import sys
import json
import yaml
from pathlib import Path
from typing import List, Set
from urllib.parse import urlparse
import requests
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

# 项目根目录
PROJECT_ROOT = Path(__file__).parent.parent
POSTS_DIR = PROJECT_ROOT / "_posts"
SLIDES_DIR = PROJECT_ROOT / "_slides"

# Supabase 配置
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")  # Service role key (bypasses RLS)
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")

# 如果没有 service key，使用 anon key（需要确保 RPC 函数允许匿名调用）
SUPABASE_KEY = SUPABASE_SERVICE_KEY if SUPABASE_SERVICE_KEY else SUPABASE_ANON_KEY

# Jekyll 配置
JEKYLL_CONFIG_FILE = PROJECT_ROOT / "_config.yml"
BASEURL = ""


def load_jekyll_config():
    """加载 Jekyll 配置获取 baseurl"""
    global BASEURL
    try:
        with open(JEKYLL_CONFIG_FILE, 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f) or {}
            BASEURL = config.get('baseurl', '') or ''
    except Exception as e:
        print(f"⚠️  警告: 无法读取 _config.yml: {e}")
        BASEURL = ''


def normalize_url(url: str) -> str:
    """
    规范化 URL：移除 baseurl，确保以 / 开头，移除尾部斜杠（除非是根路径）
    """
    if not url:
        return ""
    
    # 移除 baseurl
    if BASEURL and BASEURL != '/' and url.startswith(BASEURL):
        url = url[len(BASEURL):]
    
    # 确保以 / 开头
    if not url.startswith('/'):
        url = '/' + url
    
    # 移除尾部斜杠（除非是根路径）
    if url != '/' and url.endswith('/'):
        url = url.rstrip('/')
    
    return url


def get_all_post_urls() -> Set[str]:
    """
    扫描 _posts/ 和 _slides/ 目录，提取所有文章的 URL
    
    返回规范化的 URL 集合
    """
    post_urls = set()
    
    # 读取 Jekyll 配置
    load_jekyll_config()
    
    # 扫描 _posts/ 目录
    if POSTS_DIR.exists():
        for post_file in POSTS_DIR.rglob("*.html"):
            try:
                # 读取文件获取 front matter
                with open(post_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # 解析 front matter
                if content.startswith('---'):
                    parts = content.split('---', 2)
                    if len(parts) >= 3:
                        front_matter = yaml.safe_load(parts[1]) or {}
                        
                        # 获取 URL（优先使用 permalink，否则从文件路径计算）
                        url = front_matter.get('permalink') or front_matter.get('url')
                        
                        if not url:
                            # 从文件路径计算 URL
                            # 文件路径: _posts/llm/algorithm/2024/01/01/article.html
                            # 目标URL: /papers/llm/algorithm/2024/01/01/article.html
                            relative_path = post_file.relative_to(POSTS_DIR)
                            url = '/papers/' + str(relative_path).replace('\\', '/')
                        
                        # 规范化 URL
                        normalized = normalize_url(url)
                        if normalized:
                            post_urls.add(normalized)
            except Exception as e:
                print(f"⚠️  警告: 无法处理文件 {post_file}: {e}")
                continue
    else:
        print(f"⚠️  警告: {POSTS_DIR} 目录不存在")
    
    # 扫描 _slides/ 目录
    if SLIDES_DIR.exists():
        for slide_file in SLIDES_DIR.rglob("*.html"):
            try:
                # 读取文件获取 front matter
                with open(slide_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # 解析 front matter
                if content.startswith('---'):
                    parts = content.split('---', 2)
                    if len(parts) >= 3:
                        front_matter = yaml.safe_load(parts[1]) or {}
                        
                        # 获取 URL（优先使用 permalink，否则从文件路径计算）
                        url = front_matter.get('permalink') or front_matter.get('url')
                        
                        if not url:
                            # 从文件路径计算 URL
                            # 文件路径: _slides/category/2024/01/01/slide.html
                            # 目标URL: /slides/category/2024/01/01/slide.html
                            relative_path = slide_file.relative_to(SLIDES_DIR)
                            url = '/slides/' + str(relative_path).replace('\\', '/')
                        
                        # 规范化 URL
                        normalized = normalize_url(url)
                        if normalized:
                            post_urls.add(normalized)
            except Exception as e:
                print(f"⚠️  警告: 无法处理文件 {slide_file}: {e}")
                continue
    else:
        print(f"⚠️  警告: {SLIDES_DIR} 目录不存在（这是正常的，如果构建时 _slides 是从 deepnotes 同步的）")
    
    print(f"✅ 找到 {len(post_urls)} 篇有效文章（包含 papers 和 slides）")
    return post_urls


def call_supabase_rpc(function_name: str, params: dict) -> dict:
    """
    调用 Supabase RPC 函数
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError("Supabase URL 或 Key 未设置")
    
    url = f"{SUPABASE_URL}/rest/v1/rpc/{function_name}"
    headers = {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }
    
    response = requests.post(url, json=params, headers=headers)
    
    if response.status_code != 200:
        error_msg = response.text
        try:
            error_data = response.json()
            error_msg = error_data.get('message', error_msg)
        except:
            pass
        
        raise Exception(f"Supabase RPC 调用失败 ({response.status_code}): {error_msg}")
    
    return response.json()


def cleanup_supabase_records(valid_urls: Set[str]) -> dict:
    """
    清理 Supabase 中的无效记录
    
    返回清理结果统计
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("⚠️  警告: Supabase 配置未设置，跳过清理")
        return {
            'favorites_deleted': 0,
            'clicks_deleted': 0,
            'skipped': True
        }
    
    # 转换为列表（Supabase 需要数组格式）
    valid_urls_list = list(valid_urls)
    
    if not valid_urls_list:
        print("⚠️  警告: 没有有效文章 URL，跳过清理")
        return {
            'favorites_deleted': 0,
            'clicks_deleted': 0,
            'skipped': True
        }
    
    print(f"🔄 开始清理 Supabase 无效记录...")
    print(f"   有效文章数量: {len(valid_urls_list)}")
    
    results = {
        'favorites_deleted': 0,
        'favorites_urls': [],
        'clicks_deleted': 0,
        'clicks_urls': [],
        'skipped': False
    }
    
    try:
        # 调用批量清理函数
        response = call_supabase_rpc('cleanup_all_invalid_records', {
            'p_valid_urls': valid_urls_list
        })
        
        if response and len(response) > 0:
            result = response[0] if isinstance(response, list) else response
            
            results['favorites_deleted'] = result.get('favorites_deleted', 0)
            results['favorites_urls'] = result.get('favorites_urls', [])
            results['clicks_deleted'] = result.get('clicks_deleted', 0)
            results['clicks_urls'] = result.get('clicks_urls', [])
            
            print(f"✅ 清理完成:")
            print(f"   - 删除收藏记录: {results['favorites_deleted']} 条")
            if results['favorites_urls'] and len(results['favorites_urls']) > 0:
                print(f"   - 无效收藏 URL (前5个): {', '.join(results['favorites_urls'][:5])}")
            
            print(f"   - 删除点击统计: {results['clicks_deleted']} 条")
            if results['clicks_urls'] and len(results['clicks_urls']) > 0:
                print(f"   - 无效点击统计 URL (前5个): {', '.join(results['clicks_urls'][:5])}")
        else:
            print("⚠️  警告: Supabase RPC 返回空结果")
    
    except Exception as e:
        print(f"❌ 错误: 清理 Supabase 记录失败: {e}")
        # 不抛出异常，允许继续执行
        results['error'] = str(e)
    
    return results


def main():
    """主函数"""
    print("=" * 60)
    print("🔄 Supabase 与论文文章同步脚本")
    print("=" * 60)
    
    # 1. 获取所有有效文章 URL
    print("\n📚 步骤 1: 扫描文章文件...")
    print(f"   BaseURL: {BASEURL}")
    valid_urls = get_all_post_urls()
    
    if not valid_urls:
        print("❌ 错误: 没有找到任何文章，退出")
        sys.exit(1)
    
    # 显示一些示例 URL 用于调试
    print(f"\n📋 示例 URL (前5个):")
    for i, url in enumerate(list(valid_urls)[:5]):
        print(f"   {i+1}. {url}")
    
    # 2. 清理 Supabase 无效记录
    print("\n🗑️  步骤 2: 清理 Supabase 无效记录...")
    print(f"   有效 URL 总数: {len(valid_urls)}")
    results = cleanup_supabase_records(valid_urls)
    
    # 3. 输出总结
    print("\n" + "=" * 60)
    print("✅ 同步完成!")
    print("=" * 60)
    
    if not results.get('skipped', False):
        print(f"📊 清理统计:")
        print(f"   - 收藏记录: {results['favorites_deleted']} 条已删除")
        if results.get('favorites_urls') and len(results['favorites_urls']) > 0:
            print(f"   - 被删除的收藏 URL 示例 (前3个):")
            for url in results['favorites_urls'][:3]:
                print(f"     * {url}")
        print(f"   - 点击统计: {results['clicks_deleted']} 条已删除")
        if results.get('clicks_urls') and len(results['clicks_urls']) > 0:
            print(f"   - 被删除的点击统计 URL 示例 (前3个):")
            for url in results['clicks_urls'][:3]:
                print(f"     * {url}")
        
        # 如果删除数量很大，发出警告
        total_deleted = results.get('favorites_deleted', 0) + results.get('clicks_deleted', 0)
        if total_deleted > 100:
            print(f"\n⚠️  警告: 删除了大量记录 ({total_deleted} 条)，请检查 URL 匹配是否正确！")
    else:
        print("⚠️  跳过清理（Supabase 配置未设置）")
    
    if results.get('error'):
        print(f"\n❌ 错误: {results['error']}")
        sys.exit(1)


if __name__ == "__main__":
    main()



