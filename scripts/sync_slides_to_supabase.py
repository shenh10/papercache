#!/usr/bin/env python3
"""把 _site/slides 下构建好的演示文稿页面上传到 Supabase 私有存储。

- 元数据 upsert 到 slides_search（service_role 绕过 RLS）
- HTML 上传到私有桶 slides，content_md5 未变则跳过
需环境变量：SUPABASE_URL / SUPABASE_SERVICE_KEY
"""
import hashlib
import os
import re
import sys
from datetime import datetime, timezone

import requests
from bs4 import BeautifulSoup

SITE_DIR = os.environ.get("SITE_DIR", "_site")
SLIDES_DIR = os.path.join(SITE_DIR, "slides")
BUCKET = "slides"


def die(msg):
    print(f"❌ {msg}", file=sys.stderr)
    sys.exit(1)


def main():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        die("缺少 SUPABASE_URL / SUPABASE_SERVICE_KEY")
    if not os.path.isdir(SLIDES_DIR):
        print("ℹ️  本次构建没有 slides，跳过")
        return

    headers = {"apikey": key, "Authorization": f"Bearer {key}"}

    # 已有的 md5，跳过未变化的对象
    existing = {}
    r = requests.get(f"{url}/rest/v1/slides_search?select=post_url,content_md5",
                     headers=headers, timeout=30)
    if r.status_code != 200:
        die(f"读取 slides_search 失败（先在 Dashboard 执行 scripts/supabase-slides-schema.sql）: {r.status_code} {r.text[:200]}")
    for row in r.json():
        existing[row["post_url"]] = row.get("content_md5")

    rows = []
    uploaded = skipped = 0
    for root, _, files in os.walk(SLIDES_DIR):
        for name in files:
            if not name.endswith(".html"):
                continue
            path = os.path.join(root, name)
            rel = os.path.relpath(path, SITE_DIR).replace(os.sep, "/")
            post_url = "/" + rel
            html = open(path, encoding="utf-8").read()
            md5 = hashlib.md5(html.encode()).hexdigest()

            soup = BeautifulSoup(html, "lxml")
            title_el = soup.select_one(".post-title") or soup.find("h1")
            date_el = soup.select_one(".post-meta time.dt-published, .post-meta time")
            content_el = soup.select_one(".post-content")
            first_p = content_el.find("p") if content_el else None
            m = re.match(r"^/slides/(.+)/(\d{4})/(\d{2})/\d{2}/[^/]+\.html$", post_url)
            cats = m.group(1).split("/") if m else []
            rows.append({
                "post_url": post_url,
                "title": (title_el.get_text(strip=True) if title_el else name),
                "excerpt": (first_p.get_text(" ", strip=True)[:160] if first_p else ""),
                "categories": cats,
                "tag": "",
                "published_date": (date_el.get_text(strip=True) if date_el else (f"{m.group(2)}-{m.group(3)}" if m else "")),
                "content_md5": md5,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })

            if existing.get(post_url) == md5:
                skipped += 1
                continue
            obj_path = rel[len("slides/"):]
            up = requests.post(
                f"{url}/storage/v1/object/{BUCKET}/{obj_path}?upsert=true",
                headers={**headers, "Content-Type": "text/html", "x-upsert": "true"},
                data=html.encode("utf-8"), timeout=120)
            if up.status_code not in (200, 201):
                die(f"上传 {obj_path} 失败: {up.status_code} {up.text[:200]}")
            uploaded += 1

    if rows:
        r = requests.post(
            f"{url}/rest/v1/slides_search?on_conflict=post_url",
            headers={**headers, "Content-Type": "application/json",
                     "Prefer": "resolution=merge-duplicates"},
            json=rows, timeout=60)
        if r.status_code not in (200, 201, 204):
            die(f"upsert slides_search 失败: {r.status_code} {r.text[:200]}")

    print(f"✅ slides 同步完成：共 {len(rows)} 篇，上传 {uploaded}，跳过 {skipped}")


if __name__ == "__main__":
    main()
