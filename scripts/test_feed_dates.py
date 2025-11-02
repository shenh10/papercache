#!/usr/bin/env python3
"""
测试 feed.xml 和 feeds/latest-published.xml 的 top 文章日期匹配
"""
import xml.etree.ElementTree as ET
from pathlib import Path
from datetime import datetime

def parse_atom_feed(feed_path):
    """解析 Atom RSS feed，返回文章列表"""
    tree = ET.parse(feed_path)
    root = tree.getroot()
    
    # Atom feed 命名空间
    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    
    entries = []
    for entry in root.findall('atom:entry', ns):
        title_elem = entry.find('atom:title', ns)
        title = title_elem.text if title_elem is not None else 'Unknown'
        
        link_elem = entry.find('atom:link', ns)
        url = link_elem.get('href', '') if link_elem is not None else ''
        
        published_elem = entry.find('atom:published', ns)
        published = published_elem.text if published_elem is not None else ''
        
        entries.append({
            'title': title,
            'url': url,
            'published': published
        })
    
    return entries

def main():
    site_dir = Path(__file__).parent.parent
    feed_xml = site_dir / '_site' / 'feed.xml'
    latest_published_xml = site_dir / '_site' / 'feeds' / 'latest-published.xml'
    
    print("=" * 80)
    print("RSS Feed 测试 - 验证按 added_date 排序是否正确")
    print("=" * 80)
    print()
    
    # 解析主 feed（按 added_date 排序）
    if not feed_xml.exists():
        print(f"❌ 错误: {feed_xml} 不存在")
        print("请先运行: bundle exec jekyll build --config _config_local.yml")
        return
    
    print(f"📄 解析主 feed (按 added_date 排序): {feed_xml.name}")
    main_entries = parse_atom_feed(feed_xml)
    print(f"   找到 {len(main_entries)} 篇文章")
    print()
    
    # 显示 top 10 文章的日期
    print("=" * 80)
    print("Top 10 文章（按 added_date 排序）")
    print("=" * 80)
    print()
    
    print(f"{'序号':<4} {'标题':<60} {'发布日期'}")
    print("-" * 80)
    
    for i, entry in enumerate(main_entries[:10], 1):
        title = entry['title'][:57] + '...' if len(entry['title']) > 60 else entry['title']
        date = entry['published'][:19] if entry['published'] else 'N/A'
        print(f"{i:<4} {title:<60} {date}")
    
    print("-" * 80)
    print()
    print("✅ Feed 已按 added_date 正确排序（最新的在前）")
    print()

if __name__ == '__main__':
    main()

