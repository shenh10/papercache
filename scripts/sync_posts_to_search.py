#!/usr/bin/env python3
"""
同步论文数据到 Supabase posts_search 表
用于支持全文搜索功能
"""

import os
import sys
import json
import yaml
import re
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Set

# 添加项目根目录到路径
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# 从环境变量获取 Supabase 配置（仅在需要同步时检查）
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

import requests

def call_supabase_rpc(function_name: str, params: dict) -> dict:
    """调用 Supabase RPC 函数"""
    url = f"{SUPABASE_URL}/rest/v1/rpc/{function_name}"
    headers = {
        "Content-Type": "application/json",
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}"
    }
    
    try:
        response = requests.post(url, json=params, headers=headers, timeout=30)
        response.raise_for_status()
        return response.json() if response.content else {}
    except requests.exceptions.RequestException as e:
        print(f"⚠️  警告: 调用 {function_name} 失败: {e}")
        if hasattr(e.response, 'text'):
            print(f"   响应: {e.response.text}")
        return None

def normalize_url(url: str) -> str:
    """规范化URL"""
    if not url:
        return ""
    # 移除开头的斜杠
    normalized = url.lstrip('/')
    # 确保不是空字符串
    if not normalized:
        return ""
    # 添加前导斜杠
    if not normalized.startswith('/'):
        normalized = '/' + normalized
    return normalized

def extract_date_from_url(url: str) -> Optional[str]:
    """从URL中提取日期（格式：/papers/.../2025/06/01/...）"""
    date_pattern = r'/(\d{4})/(\d{2})/(\d{2})/'
    import re
    match = re.search(date_pattern, url)
    if match:
        year, month, day = match.groups()
        return f"{year}-{month}-{day}"
    return None

def load_collection_data() -> List[Dict]:
    """加载论文集合数据"""
    collection_path = PROJECT_ROOT / "_data" / "collection_structure.yml"
    excerpts_path = PROJECT_ROOT / "assets" / "data" / "excerpts.json"
    
    if not collection_path.exists():
        print(f"❌ 错误: {collection_path} 不存在")
        return []
    
    if not excerpts_path.exists():
        print(f"⚠️  警告: {excerpts_path} 不存在，将使用空摘要")
        excerpts_data = {}
    else:
        with open(excerpts_path, 'r', encoding='utf-8') as f:
            excerpts_data = json.load(f)
    
    # 读取集合数据
    with open(collection_path, 'r', encoding='utf-8') as f:
        collection_data = yaml.safe_load(f)
    
    papers = []
    
    def extract_papers(node, categories=None, category_name=None):
        """递归提取论文数据"""
        if categories is None:
            categories = []
        
        # 添加当前节点的分类名
        current_categories = categories.copy()
        if category_name:
            current_categories.append(category_name)
        
        # 处理当前节点的论文
        if isinstance(node, dict) and 'posts' in node:
            for post in node.get('posts', []):
                url = normalize_url(post.get('url', ''))
                if url:
                    # 使用论文自带的 categories，如果没有则使用收集的分类
                    paper_categories = post.get('categories', current_categories.copy())
                    
                    # 提取摘要：提取"主要贡献"到"背景知识"之间的完整内容
                    raw_excerpt = excerpts_data.get(url, '')
                    excerpt = raw_excerpt
                    if raw_excerpt and '主要贡献' in raw_excerpt:
                        # 匹配标题格式：可能的编号（A1、A3、1、2等）+ 空格 + "主要贡献"
                        # 或者直接是"主要贡献"（没有编号）
                        # 支持：A1 主要贡献：、主要贡献：、主要贡献如下：、主要贡献为：等格式
                        # 结束标记优先级：1) "背景知识"（可能有编号，也可能没有）
                        #                  2) "A2 方法细节"或"方法细节"（如果没有"背景知识"）
                        #                  3) 到文本结尾
                        pattern = r'(?:A\d+\s+|[0-9]+\s+)?主要贡献(?:如下|为)?[：:]\s*(.*?)(?=\s*(?:A\d+\s+|[0-9]+\s+)?(?:背景知识|方法细节)[：:\n]|$)'
                        match = re.search(pattern, raw_excerpt, re.DOTALL)
                        
                        if match:
                            # 提取匹配的内容
                            excerpt = match.group(1).strip()
                            
                            # 清理结尾：去掉可能的换行、空格等
                            excerpt = excerpt.rstrip()
                    
                    papers.append({
                        'url': url,
                        'title': post.get('title', ''),
                        'excerpt': excerpt,  # 存储完整的摘要（已提取"主要贡献"后的内容）
                        'categories': paper_categories,
                        'tag': post.get('tag', ''),
                        'date': extract_date_from_url(url) or post.get('date')
                    })
        
        # 递归处理子节点（字典的 key 就是分类名）
        if isinstance(node, dict):
            # 先处理 posts（如果存在）
            if 'posts' in node:
                # 已经处理过了，跳过
                pass
            # 处理其他子节点（这些是分类）
            for key, value in node.items():
                if key != 'posts' and isinstance(value, dict):
                    extract_papers(value, current_categories, key)
    
    # 处理顶层分类（llm, mlsys, diffusions 等）
    if isinstance(collection_data, dict):
        for category_name, category_data in collection_data.items():
            extract_papers(category_data, [], category_name)
    return papers

def export_extracted_excerpts(output_file='extracted_excerpts.json'):
    """导出提取的摘要结果到文件"""
    print("📝 开始提取摘要数据...")
    
    # 直接加载原始数据，不应用提取逻辑
    collection_path = PROJECT_ROOT / "_data" / "collection_structure.yml"
    excerpts_path = PROJECT_ROOT / "assets" / "data" / "excerpts.json"
    
    if not collection_path.exists():
        print(f"❌ 错误: {collection_path} 不存在")
        return
    
    if not excerpts_path.exists():
        print(f"⚠️  警告: {excerpts_path} 不存在")
        excerpts_data = {}
    else:
        with open(excerpts_path, 'r', encoding='utf-8') as f:
            excerpts_data = json.load(f)
    
    with open(collection_path, 'r', encoding='utf-8') as f:
        collection_data = yaml.safe_load(f)
    
    papers = []
    
    def extract_papers(node, categories=None, category_name=None):
        if categories is None:
            categories = []
        current_categories = categories.copy()
        if category_name:
            current_categories.append(category_name)
        if isinstance(node, dict) and 'posts' in node:
            for post in node.get('posts', []):
                url = normalize_url(post.get('url', ''))
                if url:
                    paper_categories = post.get('categories', current_categories.copy())
                    papers.append({
                        'url': url,
                        'title': post.get('title', ''),
                        'categories': paper_categories,
                        'tag': post.get('tag', ''),
                        'date': extract_date_from_url(url) or post.get('date')
                    })
        if isinstance(node, dict):
            for key, value in node.items():
                if key != 'posts' and isinstance(value, dict):
                    extract_papers(value, current_categories, key)
    
    if isinstance(collection_data, dict):
        for category_name, category_data in collection_data.items():
            extract_papers(category_data, [], category_name)
    
    if not papers:
        print("❌ 错误: 没有找到论文数据")
        return
    
    print(f"📚 找到 {len(papers)} 篇论文")
    
    # 统计信息
    stats = {
        'total': len(papers),
        'has_contribution_marker': 0,
        'has_background_marker': 0,
        'has_method_marker': 0,
        'extracted_from_contribution': 0,
        'full_excerpt': 0
    }
    
    # 准备导出数据
    export_data = []
    
    for paper in papers:
        # 从原始 excerpts_data 读取原始摘要
        raw_excerpt = excerpts_data.get(paper['url'], '')
        extracted_excerpt = raw_excerpt  # 默认使用原始摘要
        
        # 检查是否有"主要贡献"标记
        if '主要贡献' in raw_excerpt:
            stats['has_contribution_marker'] += 1
            
            # 尝试提取
            pattern = r'(?:A\d+\s+|[0-9]+\s+)?主要贡献(?:如下|为)?[：:]\s*(.*?)(?=\s*(?:A\d+\s+|[0-9]+\s+)?(?:背景知识|方法细节)[：:\n]|$)'
            match = re.search(pattern, raw_excerpt, re.DOTALL)
            if match:
                extracted_excerpt = match.group(1).strip().rstrip()
                stats['extracted_from_contribution'] += 1
                
                # 检查结束标记（在原始摘要中查找）
                if '背景知识' in raw_excerpt:
                    stats['has_background_marker'] += 1
                elif '方法细节' in raw_excerpt:
                    stats['has_method_marker'] += 1
        else:
            stats['full_excerpt'] += 1
        
        export_data.append({
            'url': paper['url'],
            'title': paper['title'],
            'raw_excerpt': raw_excerpt,
            'extracted_excerpt': extracted_excerpt,
            'excerpt_length': len(raw_excerpt),
            'extracted_length': len(extracted_excerpt),
            'is_extracted': extracted_excerpt != raw_excerpt
        })
    
    # 保存到文件
    output_path = PROJECT_ROOT / output_file
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump({
            'stats': stats,
            'papers': export_data
        }, f, ensure_ascii=False, indent=2)
    
    print(f"\n✅ 导出完成:")
    print(f"   - 文件: {output_path}")
    print(f"   - 总论文数: {stats['total']} 篇")
    print(f"   - 包含\"主要贡献\"标记: {stats['has_contribution_marker']} 篇")
    print(f"   - 成功提取: {stats['extracted_from_contribution']} 篇")
    print(f"   - 包含\"背景知识\"标记: {stats['has_background_marker']} 篇")
    print(f"   - 包含\"方法细节\"标记: {stats['has_method_marker']} 篇")
    print(f"   - 使用完整摘要: {stats['full_excerpt']} 篇")
    
    # 显示一些示例
    print(f"\n📋 示例（前5篇包含\"主要贡献\"的论文）:")
    count = 0
    for paper_data in export_data:
        if paper_data['is_extracted']:
            count += 1
            print(f"\n示例 {count}:")
            print(f"  URL: {paper_data['url'][:60]}...")
            print(f"  标题: {paper_data['title'][:50]}...")
            print(f"  原始摘要长度: {paper_data['excerpt_length']}")
            print(f"  提取后长度: {paper_data['extracted_length']}")
            print(f"  原始摘要: {paper_data['raw_excerpt'][:100]}...")
            print(f"  提取后: {paper_data['extracted_excerpt'][:100]}...")
            if count >= 5:
                break

def sync_posts_to_search():
    """同步论文数据到搜索表"""
    # 检查环境变量
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("❌ 错误: 请设置 SUPABASE_URL 和 SUPABASE_SERVICE_KEY 环境变量")
        sys.exit(1)
    
    print("🚀 开始同步论文数据到 Supabase posts_search 表...")
    
    papers = load_collection_data()
    if not papers:
        print("❌ 错误: 没有找到论文数据")
        return
    
    print(f"📚 找到 {len(papers)} 篇论文")
    print(f"🔄 开始同步，请稍候...")
    
    success_count = 0
    fail_count = 0
    
    for i, paper in enumerate(papers, 1):
        try:
            # 显示进度（每10篇或每50篇）
            if i == 1 or i % 10 == 0 or i == len(papers):
                print(f"   📝 正在同步 {i}/{len(papers)}: {paper['title'][:50]}...")
            
            result = call_supabase_rpc('upsert_post_search', {
                'p_url': paper['url'],
                'p_title': paper['title'],
                'p_excerpt': paper.get('excerpt', ''),
                'p_categories': paper.get('categories', []),
                'p_tag': paper.get('tag'),
                'p_published_date': paper.get('date')
            })
            
            if result is not None:
                success_count += 1
                if i % 50 == 0:
                    print(f"   ✅ 已同步 {i}/{len(papers)} 篇论文...")
            else:
                fail_count += 1
                print(f"   ❌ 同步失败: {paper['url']}")
        
        except Exception as e:
            fail_count += 1
            print(f"   ❌ 同步失败: {paper['url']} - {e}")
        
        # 添加小延迟，避免请求过快
        if i % 10 == 0:
            import time
            time.sleep(0.1)
    
    print(f"\n✅ 同步完成:")
    print(f"   - 成功: {success_count} 篇")
    print(f"   - 失败: {fail_count} 篇")
    print(f"   - 总计: {len(papers)} 篇")

if __name__ == "__main__":
    import sys
    # 如果命令行参数包含 --export，则导出到文件
    if '--export' in sys.argv or len(sys.argv) > 1 and sys.argv[1] == 'export':
        export_extracted_excerpts()
    else:
        sync_posts_to_search()

