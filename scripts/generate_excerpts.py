#!/usr/bin/env python3
"""
生成文章摘要映射文件
类似于缩略图的处理方式，预先提取所有文章的摘要并保存到JSON文件中
"""

import os
import json
import re
from pathlib import Path
from bs4 import BeautifulSoup

def extract_excerpt_from_file(file_path):
    """从单个文章文件中提取摘要"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 分离 front matter 和内容
        if not content.startswith('---'):
            return None
        
        parts = content.split('---', 2)
        if len(parts) < 3:
            return None
        
        front_matter = parts[1].strip()
        post_content = parts[2]
        
        # 解析HTML内容
        soup = BeautifulSoup(post_content, 'html.parser')
        
        # 查找主要贡献段落
        headings = soup.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
        excerpt_text = None
        
        for heading in headings:
            heading_text = heading.get_text().strip()
            # 匹配 "A1 主要贡献" 或 "主要贡献"
            if re.search(r'(A1\s*)?主要贡献', heading_text):
                # 找到下一个段落
                next_element = heading.find_next_sibling()
                while next_element:
                    if next_element.name in ['p', 'div']:
                        text = next_element.get_text().strip()
                        if text and len(text) > 20:
                            excerpt_text = text
                            break
                    next_element = next_element.find_next_sibling()
                break
        
        # 如果没有找到主要贡献段落，使用第一个较长的段落
        if not excerpt_text:
            paragraphs = soup.find_all('p')
            for p in paragraphs:
                text = p.get_text().strip()
                if text and len(text) > 30:
                    excerpt_text = text
                    break
        
        # 截断到80字符
        if excerpt_text:
            if len(excerpt_text) > 80:
                excerpt_text = excerpt_text[:77] + '...'
            return excerpt_text
        
        return None
        
    except Exception as e:
        print(f"处理 {file_path} 时出错: {e}")
        return None

def generate_excerpts_mapping():
    """生成所有文章的摘要映射"""
    posts_dir = Path('_posts')
    if not posts_dir.exists():
        print("❌ _posts 目录不存在")
        return
    
    html_files = list(posts_dir.glob('*.html'))
    print(f"找到 {len(html_files)} 个文章文件")
    
    excerpts_mapping = {}
    success_count = 0
    
    for file_path in html_files:
        # 从文件名提取文章URL
        filename = file_path.stem
        # 移除日期前缀 (YYYY-MM-DD-)
        if len(filename) > 10 and filename[10] == '-':
            article_slug = filename[11:]  # 移除日期前缀
        else:
            article_slug = filename
        
        # 构建文章URL - 使用正确的路径格式
        article_url = f"/papers/{article_slug}.html"
        
        # 提取摘要
        excerpt = extract_excerpt_from_file(file_path)
        if excerpt:
            excerpts_mapping[article_url] = excerpt
            success_count += 1
            print(f"✅ {article_slug}: {excerpt[:50]}...")
        else:
            print(f"❌ {article_slug}: 无法提取摘要")
    
    # 保存到JSON文件
    output_file = 'assets/data/excerpts.json'
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(excerpts_mapping, f, ensure_ascii=False, indent=2)
    
    print(f"\n✅ 完成！成功提取了 {success_count} 个文章摘要")
    print(f"📁 摘要映射已保存到: {output_file}")

if __name__ == "__main__":
    generate_excerpts_mapping()
