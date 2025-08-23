---
layout: default
title: "PaperCache - Deep Notes"
description: "深度学习、机器学习和人工智能研究论文的精选缓存"
---

# 欢迎来到 PaperCache

深度学习、机器学习和人工智能研究论文的精选缓存和展示平台。

## 🔍 最新论文

{% for post in site.posts limit:10 %}
<div class="post-preview">
  <h3><a href="{{ post.url | relative_url }}">{{ post.title }}</a></h3>
  <p class="post-meta">{{ post.date | date: "%Y年%m月%d日" }}</p>
  {% if post.excerpt %}
  <p>{{ post.excerpt | strip_html | truncate: 150 }}</p>
  {% endif %}
  {% if post.categories %}
  <div class="categories">
    {% for category in post.categories %}
    <span class="category-tag">{{ category }}</span>
    {% endfor %}
  </div>
  {% endif %}
</div>
{% endfor %}

## 📚 论文分类

### 🤖 大语言模型 (LLM)
- **算法研究**: Transformer变体、注意力机制、强化学习
- **工程实践**: 训练优化、推理加速、系统设计

### 🎨 扩散模型
- **扩散过程**: 前向和反向扩散、噪声调度
- **应用领域**: 图像生成、文本到图像合成

### ⚙️ 机器学习系统
- **系统架构**: 分布式计算框架、资源管理
- **数据管理**: 数据流水线、特征存储

## 📞 关于本站

这个站点由 [Deep Notes](https://github.com/shenh10/deepnotes) 项目自动生成和维护，专注于展示AI/ML领域的前沿研究论文。

- **源代码仓库**: [shenh10/deepnotes](https://github.com/shenh10/deepnotes)
- **自动化部署**: 通过 GitHub Actions 实现
- **技术栈**: Jekyll + GitHub Pages + Giscus 评论

---

*本站内容持续更新，展示AI和机器学习领域的最新研究成果。*

<style>
.post-preview {
  margin: 2em 0;
  padding: 1.5em;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  background: #fafafa;
}

.post-preview h3 {
  margin-top: 0;
  margin-bottom: 0.5em;
}

.post-preview h3 a {
  color: #2c3e50;
  text-decoration: none;
}

.post-preview h3 a:hover {
  color: #3498db;
}

.post-meta {
  color: #666;
  font-size: 0.9em;
  margin: 0.5em 0;
}

.categories {
  margin-top: 1em;
}

.category-tag {
  background: #e3f2fd;
  color: #1976d2;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.8em;
  margin-right: 6px;
}
</style>
