#!/usr/bin/env python3
"""
重新排列 collection_structure.yml 中的章节顺序
将 diffusions 章节移动到 mlsys 之后
"""

import yaml
import sys

def reorder_sections():
    # 读取原始文件
    with open('_data/collection_structure.yml', 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f)
    
    # 定义新的章节顺序
    new_order = []
    
    # 按顺序添加章节
    for key in data.keys():
        if key == 'diffusions':
            # 跳过 diffusions，稍后添加
            continue
        new_order.append(key)
        
        # 在 mlsys 之后添加 diffusions
        if key == 'mlsys':
            new_order.append('diffusions')
    
    # 重新构建有序字典
    reordered_data = {}
    for key in new_order:
        if key in data:
            reordered_data[key] = data[key]
    
    # 写入新文件
    with open('_data/collection_structure.yml', 'w', encoding='utf-8') as f:
        yaml.dump(reordered_data, f, default_flow_style=False, allow_unicode=True, sort_keys=False)
    
    print("章节顺序已重新排列:")
    for i, key in enumerate(reordered_data.keys(), 1):
        print(f"{i}. {key}")
    
    print(f"\n总共 {len(reordered_data)} 个章节")

if __name__ == "__main__":
    reorder_sections()
