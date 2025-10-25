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
TABLE_OR_FORMULA_RE = re.compile(r"(\b表\b|\btable\b|\b公式\b|\bkatex\b|\blatex\b|\bformula\b|\bequation\b|\b算法\b)", re.IGNORECASE)

ALLOWED_SCHEMES = {"http", "https", "file"}


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
    pattern_table = re.compile(r'(\btable\b|\btab\.?\b|表\d+|表\s|^表|表$)', re.IGNORECASE)
    pattern_formula = re.compile(r'(\bformula\b|\beq\.?\b|\bequation\b|公式\d+|公式\s|^公式|公式$)', re.IGNORECASE)
    
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
    
def get_nearest_neighbor_text(fig, pattern_figure):
    """Get nearest neighbor text from adjacent elements (only when annotation is empty)"""
    # Pattern to match figure titles that START with "图/Figure/Fig"
    pattern_figure_start = re.compile(r'^(图\s*\d+|figure\s*\d+|fig\.?\s*\d+)', re.IGNORECASE)
    
    # Check next sibling (skip whitespace and <br>, stop at other <figure> start tags)
    next_elem = fig.next_sibling
    skipped_br = False
    while next_elem:
        if hasattr(next_elem, 'name'):
            # Stop at other <figure> start tags - 遇到下一个figure就停止
            if next_elem.name == 'figure':
                break
            if next_elem.name == 'br':
                skipped_br = True
                next_elem = next_elem.next_sibling
                continue
            # 遇到有内容的元素，检查是否以"图"开头
            text = next_elem.get_text(strip=True)
            if text:
                if pattern_figure_start.match(text):
                    return text
                # 遇到有内容但不匹配的元素，停止搜索
                break
        else:
            # Text node
            text = str(next_elem).strip()
            if text:
                if pattern_figure_start.match(text):
                    return text
                # 遇到有内容但不匹配的文本，停止搜索
                break
        next_elem = next_elem.next_sibling
    
    # Check previous sibling (skip whitespace and <br>, stop at other <figure> start tags or <p> tags)
    prev_elem = fig.previous_sibling
    while prev_elem:
        if hasattr(prev_elem, 'name'):
            # Stop at other <figure> or <p> tags
            if prev_elem.name in ['figure', 'p']:
                break
            if prev_elem.name == 'br':
                prev_elem = prev_elem.previous_sibling
                continue
            # 遇到有内容的元素，检查是否以"图"开头
            text = prev_elem.get_text(strip=True)
            if text:
                if pattern_figure_start.match(text):
                    return text
                # 遇到有内容但不匹配的元素，停止搜索
                break
        else:
            # Text node - check if parent is <p>
            if hasattr(prev_elem, 'parent') and prev_elem.parent.name == 'p':
                # 如果文本节点的父元素是<p>，停止搜索
                break
            text = str(prev_elem).strip()
            if text:
                if pattern_figure_start.match(text):
                    return text
                # 遇到有内容但不匹配的文本，停止搜索
                break
        prev_elem = prev_elem.previous_sibling
    
    return ''

def calculate_figure_distance(fig, neighbor_text):
    """计算figure和其邻居文本之间的距离"""
    # 简单的距离计算：基于HTML中的字符距离
    # 这里可以根据需要实现更复杂的距离算法
    
    # 获取figure在HTML中的位置
    fig_html = str(fig)
    fig_start = fig_html.find('<figure')
    if fig_start == -1:
        return 999  # 如果找不到figure标签，返回大距离
    
    # 计算到邻居文本的距离
    # 这里使用简单的启发式：检查figure前后的文本节点数量
    distance = 0
    
    # 检查前面的兄弟节点
    prev_elem = fig.previous_sibling
    while prev_elem:
        if hasattr(prev_elem, 'name'):
            if prev_elem.name in ['p', 'figure']:
                break
            distance += 1
        else:
            text = str(prev_elem).strip()
            if text and neighbor_text in text:
                # 如果找到包含邻居文本的节点，距离较小
                return distance
        prev_elem = prev_elem.previous_sibling
        distance += 1
    
    # 检查后面的兄弟节点
    next_elem = fig.next_sibling
    distance = 0
    while next_elem:
        if hasattr(next_elem, 'name'):
            if next_elem.name in ['p', 'figure']:
                break
            distance += 1
        else:
            text = str(next_elem).strip()
            if text and neighbor_text in text:
                # 如果找到包含邻居文本的节点，返回距离
                return distance
        next_elem = next_elem.next_sibling
        distance += 1
    
    return distance

def is_figure_matching_title(fig, neighbor_text):
    """判断figure是否真正匹配图标题"""
    # 检查figure之后的文本是否包含图标题
    # 如果figure之后紧跟着图标题文本，说明这个figure匹配该标题
    
    # 检查figure之后的兄弟节点
    next_elem = fig.next_sibling
    while next_elem:
        if hasattr(next_elem, 'name'):
            if next_elem.name in ['p', 'figure']:
                break
            # 检查元素内的文本
            text = next_elem.get_text(strip=True)
            if text and neighbor_text in text:
                return True
        else:
            # 文本节点
            text = str(next_elem).strip()
            if text and neighbor_text in text:
                return True
        next_elem = next_elem.next_sibling
    
    # 如果figure之后没有找到匹配的文本，检查figure之前
    prev_elem = fig.previous_sibling
    while prev_elem:
        if hasattr(prev_elem, 'name'):
            if prev_elem.name in ['p', 'figure']:
                break
            # 检查元素内的文本
            text = prev_elem.get_text(strip=True)
            if text and neighbor_text in text:
                return True
        else:
            # 文本节点
            text = str(prev_elem).strip()
            if text and neighbor_text in text:
                return True
        prev_elem = prev_elem.previous_sibling
    
    return False

def pick_first_valid_img(html, is_slides=False):
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
    pattern_table = re.compile(r'(\btable\b|\btab\.?\b|表\d+|表\s|^表|表$)', re.IGNORECASE)
    pattern_formula = re.compile(r'(\bformula\b|\beq\.?\b|\bequation\b|公式\d+|公式\s|^公式|公式$)', re.IGNORECASE)
    
    def contains_table_or_formula(text):
        if not text:
            return False
        return bool(pattern_table.search(text) or pattern_formula.search(text))
    
    def get_figure_annotation(fig):
        cap = fig.find('figcaption')
        img = fig.find('img', src=True)
        if not img:
            return ''
        capText = (cap.text if cap else '').strip()
        alt = (img.get('alt') or '').strip()
        title = (img.get('title') or '').strip()
        return (capText + ' ' + alt + ' ' + title).strip()
    
    # 1. 从前到后遍历所有可行图，找到第一个真正匹配图标题的figure
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
        
        # 如果figure的annotation为空，则检查最近的邻居节点
        if not annotation or annotation.strip() == '':
            neighbor_text = get_nearest_neighbor_text(fig, pattern_figure)
            if i < 3:
                print(f"    Nearest neighbor text: '{neighbor_text[:100]}...'")
            if neighbor_text and pattern_figure.search(neighbor_text):
                # 3. 排除一些非法图片：如果邻居文本包含表/公式字段的图片不选择
                if not contains_table_or_formula(neighbor_text):
                    src = img.get('src')
                    if src and is_usable_src(src):  # Now we support data URLs too
                        if i < 3:
                            print(f"    Found via nearest neighbor: {src[:50]}...")
                        # 直接返回第一个匹配的figure
                        return src
    
    # 4. 段首"图1/Figure 1/Fig. 1" → 回溯至上一个 <img> 或 <figure>
    # 或者段落本身包含图片且文本中包含"图X/Figure X"
    paragraphs = soup.find_all('p')
    head_pattern = re.compile(r'^(图\s*\d+|figure\s*\d+|fig\.?\s*\d+)', re.IGNORECASE)
    contain_pattern = re.compile(r'(图\s*\d+|figure\s*\d+|fig\.?\s*\d+)', re.IGNORECASE)
    
    for p in paragraphs:
        text = p.get_text(strip=True)
        
        # 首先检查段落本身是否包含图片
        p_img = p.find('img', src=True)
        if p_img and contain_pattern.search(text) and not contains_table_or_formula(text):
            # 段落包含图片且文本中有"图X/Figure X"
            src = p_img.get('src')
            alt = p_img.get('alt', '')
            title = p_img.get('title', '')
            hint = (alt + ' ' + title).strip()
            if not contains_table_or_formula(hint) and is_usable_src(src):
                print(f"    通过段落本身找到图片: {src[:50]}...")
                return src
        
        # 如果段落以"图X/Figure X"开头，但不包含图片，则向前回溯
        if head_pattern.match(text) and not contains_table_or_formula(text) and not p_img:
            
            # 向上找最近的图片（优先找figure中的img，然后找单独的img）
            prev = p.previous_sibling
            while prev:
                if hasattr(prev, 'name'):
                    if prev.name == 'figure':
                        fig_img = prev.find('img', src=True)
                        if fig_img:
                            src = fig_img.get('src')
                            alt = fig_img.get('alt', '')
                            title = fig_img.get('title', '')
                            hint = (alt + ' ' + title).strip()
                            if not contains_table_or_formula(hint) and is_usable_src(src):
                                print(f"    通过段落回溯找到figure中的图片: {src[:50]}...")
                                return src
                    else:
                        # 检查其他元素中的img
                        cand_img = prev.find('img', src=True)
                        if cand_img:
                            src = cand_img.get('src')
                            alt = cand_img.get('alt', '')
                            title = cand_img.get('title', '')
                            hint = (alt + ' ' + title).strip()
                            if not contains_table_or_formula(hint) and is_usable_src(src):
                                print(f"    通过段落回溯找到图片: {src[:50]}...")
                                return src
                prev = prev.previous_sibling
    
    # 5. 如果最终没找到合适的图，重新过滤一遍全部图，返回不包含表/公式字段的第一张图
    for fig in figures:
        img = fig.find('img', src=True)
        if not img:
            continue
        
        annotation = get_figure_annotation(fig)
        neighbor_text = get_nearest_neighbor_text(fig, pattern_figure)
        all_text = (annotation + ' ' + neighbor_text).strip()
        if not contains_table_or_formula(all_text):
            src = img.get('src')
            if is_usable_src(src):
                return src
    
    # 6. 如果还是不能，返回None（会在后面生成占位符）
    return None


def generate_deterministic_filename(post_url: str) -> str:
    """
    基于文章URL生成确定性的缩略图文件名
    使用URL路径的哈希值，确保相同URL总是生成相同的文件名
    """
    import hashlib
    # 使用URL路径部分生成哈希，避免协议和域名变化影响
    url_path = urllib.parse.urlparse(post_url).path
    # 移除文件扩展名，只保留路径部分
    url_path = url_path.replace('.html', '').strip('/')
    # 生成MD5哈希的前8位作为文件名
    hash_obj = hashlib.md5(url_path.encode('utf-8'))
    return hash_obj.hexdigest()[:8] + '.jpg'


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
    - start if has _data (and optionally _site)
    - start/papercache if has _data (and optionally _site)
    - first child under start with _data (and optionally _site) (shallow)
    - raise if not found
    
    Note: _site directory is optional as it's only created after Jekyll build
    """
    cand = start
    # Check if current directory has _data (Jekyll site indicator)
    if (cand / "_data").exists():
        return cand
    
    # Check papercache subdirectory
    cand2 = start / "papercache"
    if cand2.exists() and (cand2 / "_data").exists():
        return cand2
    
    # Check all children for Jekyll site
    for child in start.iterdir():
        if child.is_dir() and (child / "_data").exists():
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
    ap.add_argument("--thumbnails-out", default="assets/data", help="thumbnails output directory (relative to site dir)")
    ap.add_argument("--mapping-out", default="_data", help="mapping file output directory (relative to site dir)")
    ap.add_argument("--size", type=parse_size, default="320x200", help="e.g., 320x200")
    ap.add_argument("--placeholder", action="store_true", help="Generate placeholder thumbnails for posts without images")
    args = ap.parse_args()

    project_root = pathlib.Path(args.root).resolve()
    if args.site:
        site_dir = pathlib.Path(args.site).resolve()
    else:
        site_dir = auto_detect_site_dir(project_root)

    # 缩略图文件输出目录（供客户端访问）
    out_dir = site_dir / args.thumbnails_out
    # 映射文件输出目录（供服务器端访问）
    mapping_path = site_dir / args.mapping_out / "thumbnails_by_path.yml"
    built_site = site_dir / "_site"
    
    # Check if _site exists (required for thumbnail generation)
    if not built_site.exists():
        print(f"⚠️  Built site not found at {built_site}", file=sys.stderr)
        print(f"ℹ️  Thumbnails can only be generated after Jekyll builds the site.", file=sys.stderr)
        print(f"ℹ️  Creating empty mapping file and exiting gracefully...", file=sys.stderr)
        
        # Create empty mapping file so CI doesn't fail
        mapping_path.parent.mkdir(parents=True, exist_ok=True)
        with open(mapping_path, "w", encoding="utf-8") as f:
            yaml.safe_dump({}, f, allow_unicode=True)
        
        print(f"✅ Created empty thumbnails mapping at {mapping_path}")
        sys.exit(0)

    mapping: Dict[str, str] = {}
    
    # Load existing mapping if it exists (for incremental updates)
    existing_mapping: Dict[str, str] = {}
    if mapping_path.exists():
        try:
            with open(mapping_path, "r", encoding="utf-8") as f:
                existing_mapping = yaml.safe_load(f) or {}
            print(f"Loaded existing mapping with {len(existing_mapping)} entries")
        except Exception as e:
            print(f"Warning: Could not load existing mapping: {e}")
    
    # Create output directory if it doesn't exist
    out_dir.mkdir(parents=True, exist_ok=True)

    # Iterate posts from collection data, use p.url as key (since p.path is not present)
    processed = 0
    skipped = 0
    generated = 0
    for post in iter_posts_from_collection(site_dir):
        try:
            p_url = (post.get("url") or "").strip()
            if not p_url:
                continue
            processed += 1
            
            # Check if thumbnail already exists
            thumb_filename = generate_deterministic_filename(p_url)
            dest_rel = f"/{args.thumbnails_out.strip('/')}/{thumb_filename}"
            dest_abs = out_dir / thumb_filename
            
            if p_url in existing_mapping and dest_abs.exists():
                # Thumbnail already exists, reuse it
                mapping[p_url] = existing_mapping[p_url]
                skipped += 1
                if processed <= 5:
                    print(f"Skipping (exists): {p_url}")
                continue
            
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
            
            try:
                ensure_thumb(img_path, args.size, dest_abs)
                mapping[p_url] = dest_rel
                generated += 1
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
    
    print(f"Processed {processed} posts total: {generated} generated, {skipped} skipped (already exist)")
    
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
                thumb_filename = generate_deterministic_filename(p_url)
                dest_rel = f"/{args.thumbnails_out.strip('/')}/{thumb_filename}"
                dest_abs = out_dir / thumb_filename
                
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

    # Clean up orphaned thumbnails (thumbnails that are no longer in the mapping)
    if out_dir.exists():
        current_thumbs = {dest_abs.name for dest_abs in out_dir.glob("*.jpg")}
        valid_thumbs = {pathlib.Path(thumb_path).name for thumb_path in mapping.values()}
        orphaned = current_thumbs - valid_thumbs
        if orphaned:
            print(f"Cleaning up {len(orphaned)} orphaned thumbnails...")
            for thumb_name in orphaned:
                try:
                    (out_dir / thumb_name).unlink()
                except Exception as e:
                    print(f"  Warning: Could not delete {thumb_name}: {e}")

    mapping_path.parent.mkdir(parents=True, exist_ok=True)
    with open(mapping_path, "w", encoding="utf-8") as f:
        yaml.safe_dump(mapping, f, allow_unicode=True, sort_keys=True)

    print(f"Wrote {len(mapping)} thumbnails -> {mapping_path}")

if __name__ == "__main__":
    main()
