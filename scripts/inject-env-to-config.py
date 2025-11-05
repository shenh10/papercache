#!/usr/bin/env python3
"""
从环境变量注入 Supabase 配置到 _config.yml
使用方法: python3 scripts/inject-env-to-config.py
"""
import os
import yaml
import re
import sys

CONFIG_FILE = "_config.yml"

def inject_supabase_config():
    # 读取环境变量
    supabase_url = os.getenv("SUPABASE_URL", "")
    supabase_anon_key = os.getenv("SUPABASE_ANON_KEY", "")
    
    if not supabase_url or not supabase_anon_key:
        print("⚠️  警告: SUPABASE_URL 或 SUPABASE_ANON_KEY 环境变量未设置")
        print("   将在 _config.yml 中使用空值（用户系统将被禁用）")
        return
    
    # 读取原始配置
    try:
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            content = f.read()
            config = yaml.safe_load(content) or {}
    except FileNotFoundError:
        print(f"错误: {CONFIG_FILE} 文件不存在")
        sys.exit(1)
    except Exception as e:
        print(f"错误: 读取配置文件失败: {e}")
        sys.exit(1)
    
    # 更新 Supabase 配置
    if 'supabase' not in config:
        config['supabase'] = {}
    
    config['supabase']['url'] = supabase_url
    config['supabase']['anon_key'] = supabase_anon_key
    config['supabase']['enabled'] = True
    
    # 写回配置文件
    # 先使用 yaml.dump 生成内容
    new_content = yaml.dump(config, allow_unicode=True, default_flow_style=False, sort_keys=False)
    
    # 手动处理 supabase 部分的注释
    # 找到 supabase 部分并添加注释
    supabase_pattern = r'^supabase:'
    supabase_replacement = """# Supabase 配置 - 用户管理系统
# 注意：这些值从环境变量注入（自动生成），请勿手动编辑
# 在生产环境中，通过Vercel或GitHub Actions的环境变量设置
supabase:"""
    
    new_content = re.sub(supabase_pattern, supabase_replacement, new_content, flags=re.MULTILINE)
    
    # 写回文件
    try:
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print("✅ 已从环境变量注入 Supabase 配置到 _config.yml")
        print(f"   SUPABASE_URL: {supabase_url}")
        print(f"   SUPABASE_ANON_KEY: {supabase_anon_key[:20]}...")
    except Exception as e:
        print(f"错误: 写入配置文件失败: {e}")
        sys.exit(1)

if __name__ == "__main__":
    inject_supabase_config()



