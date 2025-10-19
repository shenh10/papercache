# Thumbnails build pipeline (生成小缩略图)

目标：构建期扫描文章首图，生成固定尺寸小缩略图，写入 `_data/thumbnails_by_path.yml`；前端直接使用，不再解析正文。

## 运行

```bash
python3 scripts/gen_thumbs.py --root .. --out assets/images/thumbs --size 320x200
```

## 说明
- 仅处理 http/https/file 的图片；跳过 data: URLs。
- 找不到合适图片则不写入映射，前端走占位图。
- 映射文件路径：`_data/thumbnails_by_path.yml`

