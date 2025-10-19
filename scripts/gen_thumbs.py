#!/usr/bin/env python3
import argparse
import os
import sys
import pathlib
import re
import shutil
import urllib.parse
from urllib.request import urlopen, Request
from typing import Any, Dict, Iterable

try:
    from PIL import Image
except Exception as e:
    print("Please install Pillow: pip install Pillow", file=sys.stderr)
    sys.exit(1)

try:
    import yaml
except Exception as e:
    print("Please install PyYAML: pip install pyyaml", file=sys.stderr)
    sys.exit(1)

HTML_IMG_RE = re.compile(r"<img[^>]+src=\"([^\"]+)\"", re.IGNORECASE)
FIGURE_RE = re.compile(r"<figure[\s\S]*?</figure>", re.IGNORECASE)
TABLE_OR_FORMULA_RE = re.compile(r"(表|table|公式|katex|latex|formula|equation|算法)", re.IGNORECASE)

ALLOWED_SCHEMES = {"http", "https", "file", ""}


def parse_size(s: str):
    try:
        w, h = s.lower().split("x")
        return int(w), int(h)
    except Exception:
        raise argparse.ArgumentTypeError("--size format should be WIDTHxHEIGHT, e.g., 320x200")


def is_usable_src(src: str) -> bool:
    if not src:
        return False
    if src.startswith("data:"):
        return True  # Now we support data URLs
    scheme = urllib.parse.urlparse(src).scheme
    return scheme in ALLOWED_SCHEMES


def download_to_tmp(src: str, site_dir: pathlib.Path, html_dir: pathlib.Path) -> pathlib.Path:
    """Resolve src to a local file (prefer local), or download http(s) to tmp."""
    # Handle data: URLs (base64 images)
    if src.startswith("data:"):
        import base64
        # Parse data URL: data:image/jpeg;base64,<data>
        header, data = src.split(",", 1)
        if "base64" in header:
            try:
                image_data = base64.b64decode(data)
                tmp = site_dir / ".thumb_tmp"
                tmp.mkdir(parents=True, exist_ok=True)
                out = tmp / (str(abs(hash(src))) + ".img")
                with open(out, "wb") as f:
                    f.write(image_data)
                return out
            except Exception as e:
                raise FileNotFoundError(f"Cannot decode data URL: {e}")
        else:
            raise FileNotFoundError(f"Unsupported data URL format: {header}")
    
    # relative path (no scheme)
    parsed = urllib.parse.urlparse(src)
    if not parsed.scheme:
        if src.startswith("/"):
            # site-root relative in built _site
            candidate = site_dir / "_site" / src.lstrip("/")
        else:
            # relative to html file directory
            candidate = html_dir / src
        if candidate.exists():
            return candidate
    # file scheme
    if parsed.scheme == "file":
        p = pathlib.Path(urllib.parse.unquote(parsed.path))
        if p.exists():
            return p
    # http/https
    if parsed.scheme in {"http", "https"}:
        req = Request(src, headers={"User-Agent": "thumb-builder/1.0"})
        with urlopen(req, timeout=20) as r:
            data = r.read()
        tmp = site_dir / ".thumb_tmp"
        tmp.mkdir(parents=True, exist_ok=True)
        out = tmp / (str(abs(hash(src))) + ".img")
        with open(out, "wb") as f:
            f.write(data)
        return out
    raise FileNotFoundError(f"Cannot resolve image src: {src}")


def pick_first_valid_img(html: str, is_slides: bool = False) -> str | None:
    """Find the first valid image using the same logic as JavaScript card-enhancements.js"""
    from bs4 import BeautifulSoup
    
    # Parse HTML
    soup = BeautifulSoup(html, 'html.parser')
    
    # For slides, use simple first figure logic
    if is_slides:
        figures = soup.find_all('figure')
        for fig in figures:
            img = fig.find('img', src=True)
            if img and is_usable_src(img.get('src')):
                src = img.get('src')
                print(f"    Slides: Found first figure image: {src[:50]}...")
                return src
        return None
    
    # For papers, use complex logic
    # Regex patterns (same as JavaScript)
    pattern_figure = re.compile(r'(图\s*\d+|figure\s*\d+|fig\.?\s*\d+)', re.IGNORECASE)
    pattern_table = re.compile(r'(表|table|tab\.?)', re.IGNORECASE)
    pattern_formula = re.compile(r'(公式|formula|eq\.?|equation)', re.IGNORECASE)
    
    def contains_table_or_formula(text):
        """Check if text contains table or formula keywords"""
        if not text:
            return False
        return bool(pattern_table.search(text) or pattern_formula.search(text))
    
    def get_figure_annotation(fig):
        """Extract annotation from figure (figcaption, alt, title)"""
        # Check figcaption
        figcaption = fig.find('figcaption')
        if figcaption:
            text = figcaption.get_text(strip=True)
            if text:
                return text
        
        # Check img alt and title
        img = fig.find('img')
        if img:
            alt = img.get('alt', '').strip()
            title = img.get('title', '').strip()
            if alt:
                return alt
            if title:
                return title
        
        return ''
    
    def get_neighbor_text(fig):
        """Get neighbor text from adjacent elements"""
        # Check next sibling
        next_elem = fig.next_sibling
        while next_elem:
            if hasattr(next_elem, 'name'):
                if next_elem.name == 'br':
                    next_elem = next_elem.next_sibling
                    continue
                if next_elem.name == 'figure':
                    break
                text = next_elem.get_text(strip=True)
                if text and pattern_figure.search(text):
                    return text
            else:
                # Text node
                text = str(next_elem).strip()
                if text and pattern_figure.search(text):
                    return text
            next_elem = next_elem.next_sibling
        
        # Check previous sibling
        prev_elem = fig.previous_sibling
        while prev_elem:
            if hasattr(prev_elem, 'name'):
                if prev_elem.name == 'br':
                    prev_elem = prev_elem.previous_sibling
                    continue
                if prev_elem.name == 'figure':
                    break
                text = prev_elem.get_text(strip=True)
                if text and pattern_figure.search(text):
                    return text
            else:
                # Text node
                text = str(prev_elem).strip()
                if text and pattern_figure.search(text):
                    return text
            prev_elem = prev_elem.previous_sibling
        
        return ''
    
    # 1. 从前到后遍历所有可行图，找到第一个满足条件的图返回
    figures = soup.find_all('figure')
    
    for i, fig in enumerate(figures):
        img = fig.find('img', src=True)
        if not img:
            continue
        
        annotation = get_figure_annotation(fig)
        
        # 2. 首先必须是个html Figure
        if fig.name != 'figure':
            continue
        
        # Debug: print first few figures
        if i < 3:
            print(f"  Figure {i+1}: annotation='{annotation}', src='{img.get('src', '')[:50]}...'")
        
        # 如果figure包含alt/annotation：annotation如果包含"图/figure/fig/Figure/Fig"，可行，选中返回
        if annotation and pattern_figure.search(annotation):
            # 3. 排除一些非法图片：如果figure annotation包含表/公式字段的图片不选择
            if not contains_table_or_formula(annotation):
                src = img.get('src')
                if src and is_usable_src(src):  # Now we support data URLs too
                    if i < 3:
                        print(f"    Found via annotation: {src[:50]}...")
                    # For data URLs, we can return them directly
                    return src
        
        # 如果figure的annotation不匹配"图x"模式，则检查紧邻的邻居<p>节点或者文本节点
        if not annotation or not pattern_figure.search(annotation):
            neighbor_text = get_neighbor_text(fig)
            if i < 3:
                print(f"    Neighbor text: '{neighbor_text[:100]}...'")
            if neighbor_text and pattern_figure.search(neighbor_text):
                # 3. 排除一些非法图片：如果邻居文本包含表/公式字段的图片不选择
                if not contains_table_or_formula(neighbor_text):
                    src = img.get('src')
                    if src and is_usable_src(src):  # Now we support data URLs too
                        if i < 3:
                            print(f"    Found via neighbor: {src[:50]}...")
                        return src
    
    # 4. 如果最终没找到合适的图，重新过滤一遍全部图，返回不包含表/公式字段的第一张图
    for fig in figures:
        img = fig.find('img', src=True)
        if not img:
            continue
        
        annotation = get_figure_annotation(fig)
        if not contains_table_or_formula(annotation):
            src = img.get('src')
            if is_usable_src(src):
                return src
    
    # 5. 如果还是不能，返回None（会在后面生成占位符）
    return None


def ensure_thumb(image_path: pathlib.Path, size: tuple[int, int], dest_path: pathlib.Path):
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(image_path) as im:
        im = im.convert("RGB")
        im.thumbnail(size, Image.LANCZOS)
        bg = Image.new("RGB", size, (245, 247, 250))
        x = (size[0] - im.width) // 2
        y = (size[1] - im.height) // 2
        bg.paste(im, (x, y))
        bg.save(dest_path, format="JPEG", quality=85, optimize=True)


def auto_detect_site_dir(start: pathlib.Path) -> pathlib.Path:
    """Detect site dir that contains Jekyll files. Priority:
    - start if has _site and _data
    - start/papercache
    - first child under start with _site and _data (shallow)
    - raise if not found
    """
    cand = start
    if (cand / "_site").exists() and (cand / "_data").exists():
        return cand
    cand2 = start / "papercache"
    if (cand2 / "_site").exists() and (cand2 / "_data").exists():
        return cand2
    for child in start.iterdir():
        if child.is_dir() and (child / "_site").exists() and (child / "_data").exists():
            return child
    raise FileNotFoundError("Cannot auto-detect site dir; specify with --site")


def iter_posts_from_collection(site_dir: pathlib.Path) -> Iterable[Dict[str, Any]]:
    """Iterate through all posts from both collection and slides"""
    
    # Process papers from collection_structure.yml
    papers_path = site_dir / "_data" / "collection_structure.yml"
    if papers_path.exists():
        data = yaml.safe_load(papers_path.read_text(encoding="utf-8"))
        def walk(node):
            if isinstance(node, dict):
                if "posts" in node and isinstance(node["posts"], list):
                    for p in node["posts"]:
                        yield p
                for v in node.values():
                    yield from walk(v)
            elif isinstance(node, list):
                for x in node:
                    yield from walk(x)
        yield from walk(data)
    
    # Process slides from slides_collection_structure.yml
    slides_path = site_dir / "_data" / "slides_collection_structure.yml"
    if slides_path.exists():
        data = yaml.safe_load(slides_path.read_text(encoding="utf-8"))
        def walk(node):
            if isinstance(node, dict):
                if "posts" in node and isinstance(node["posts"], list):
                    for p in node["posts"]:
                        yield p
                for v in node.values():
                    yield from walk(v)
            elif isinstance(node, list):
                for x in node:
                    yield from walk(x)
        yield from walk(data)


def main():
    ap = argparse.ArgumentParser(description="Generate fixed-size thumbnails and mapping YAML")
    ap.add_argument("--root", default=".", help="project root (will try auto-detect site dir under it)")
    ap.add_argument("--site", default=None, help="explicit site directory (contains _site/_data)")
    ap.add_argument("--out", default="assets/images/thumbs", help="output directory (relative to site dir)")
    ap.add_argument("--size", type=parse_size, default="320x200", help="e.g., 320x200")
    ap.add_argument("--placeholder", action="store_true", help="Generate placeholder thumbnails for posts without images")
    args = ap.parse_args()

    project_root = pathlib.Path(args.root).resolve()
    if args.site:
        site_dir = pathlib.Path(args.site).resolve()
    else:
        site_dir = auto_detect_site_dir(project_root)

    out_dir = site_dir / args.out
    mapping_path = site_dir / "_data" / "thumbnails_by_path.yml"
    built_site = site_dir / "_site"
    if not built_site.exists():
        print(f"Built site not found at {built_site}. Build your site first.", file=sys.stderr)
        sys.exit(1)

    mapping: Dict[str, str] = {}

    # Iterate posts from collection data, use p.url as key (since p.path is not present)
    processed = 0
    for post in iter_posts_from_collection(site_dir):
        try:
            p_url = (post.get("url") or "").strip()
            if not p_url:
                continue
            processed += 1
            if processed <= 5:  # debug first 5
                print(f"Processing: {p_url}")
            
            # resolve html path in _site
            rel = p_url.lstrip("/")
            html_file = built_site / rel
            if html_file.is_dir():
                html_file = html_file / "index.html"
            if not html_file.exists():
                if processed <= 5:
                    print(f"  HTML not found: {html_file}")
                continue
            
            html = html_file.read_text(encoding="utf-8", errors="ignore")
            # Check if this is a slides post
            is_slides = "/slides/" in p_url
            src = pick_first_valid_img(html, is_slides)
            if not src:
                if processed <= 5:
                    print(f"  No valid image found")
                continue
            
            if processed <= 5:
                print(f"  Found image: {src}")
            
            try:
                img_path = download_to_tmp(src, site_dir, html_file.parent)
            except Exception as e:
                if processed <= 5:
                    print(f"  Download failed: {e}")
                continue
            
            digest = abs(hash(p_url))
            dest_rel = f"/{args.out.strip('/')}/{digest}.jpg"
            dest_abs = out_dir / f"{digest}.jpg"
            try:
                ensure_thumb(img_path, args.size, dest_abs)
                mapping[p_url] = dest_rel
                if processed <= 5:
                    print(f"  Generated: {dest_rel}")
            except Exception as e:
                if processed <= 5:
                    print(f"  Thumbnail generation failed: {e}")
                continue
        except Exception as e:
            if processed <= 5:
                print(f"  Error processing post: {e}")
            continue
    
    print(f"Processed {processed} posts total")
    
    # Generate placeholder thumbnails if requested
    if args.placeholder:
        print("Generating placeholder thumbnails for posts without images...")
        placeholder_count = 0
        for post in iter_posts_from_collection(site_dir):
            try:
                p_url = (post.get("url") or "").strip()
                if not p_url:
                    continue
                
                # Skip if already has a thumbnail
                if p_url in mapping:
                    continue
                
                if placeholder_count < 3:  # debug first 3
                    print(f"  Creating placeholder for: {p_url}")
                
                # Generate placeholder
                digest = abs(hash(p_url))
                dest_rel = f"/{args.out.strip('/')}/{digest}.jpg"
                dest_abs = out_dir / f"{digest}.jpg"
                
                # Ensure output directory exists
                dest_abs.parent.mkdir(parents=True, exist_ok=True)
                
                # Create a simple placeholder image
                placeholder_img = Image.new('RGB', args.size, color='#1a1a2e')
                placeholder_img.save(dest_abs, 'JPEG', quality=85)
                mapping[p_url] = dest_rel
                placeholder_count += 1
                
            except Exception as e:
                if placeholder_count < 3:
                    print(f"  Error creating placeholder: {e}")
                continue
        print(f"Generated {placeholder_count} placeholder thumbnails")

    mapping_path.parent.mkdir(parents=True, exist_ok=True)
    with open(mapping_path, "w", encoding="utf-8") as f:
        yaml.safe_dump(mapping, f, allow_unicode=True, sort_keys=True)

    print(f"Wrote {len(mapping)} thumbnails -> {mapping_path}")

if __name__ == "__main__":
    main()
