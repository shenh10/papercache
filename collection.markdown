---
layout: collection
title: 论文合集
---

## 论文合集

<div class="paper-count-badge">
  收录论文总数：<strong>{{ site.posts.size }}</strong> 篇
</div>

在这里，您可以找到所有论文的完整分类列表。

---

{% assign llm_algorithm_subcategories = "agent,models,pretrain,reinforcement-learning" | split: "," %}
{% assign llm_engineering_subcategories = "attention,compiler,inference,kvcache,low_precision,speculative_decoding,train" | split: "," %}
{% assign mlsys_subcategories = "compiler,framework,gpu,networking" | split: "," %}

<!-- LLM Section -->
<h2 class="main-category-title" id="llm">LLM</h2>

<h3 class="subcategory-title" id="llm-algorithm">Algorithm</h3>
{% for subcat in llm_algorithm_subcategories %}
  <h4 class="sub-subcategory-title" id="llm-{{ subcat | slugify }}">{{ subcat | capitalize }}</h4>
  <ul class="post-list-with-tags">
    {% for post in site.categories[subcat] %}
      {% if post.categories contains 'llm' %}
        <li>
          <span class="post-meta">{{ post.date | date: "%Y-%m-%d" }}</span>
          <a class="post-link" href="{{ post.url | relative_url }}">{{ post.title | escape }}</a>
        </li>
      {% endif %}
    {% endfor %}
  </ul>
{% endfor %}

<h3 class="subcategory-title" id="llm-engineering">Engineering</h3>
{% for subcat in llm_engineering_subcategories %}
  <h4 class="sub-subcategory-title" id="llm-{{ subcat | slugify }}">{{ subcat | capitalize }}</h4>
  <ul class="post-list-with-tags">
    {% for post in site.categories[subcat] %}
      {% if post.categories contains 'llm' %}
        <li>
          <span class="post-meta">{{ post.date | date: "%Y-%m-%d" }}</span>
          <a class="post-link" href="{{ post.url | relative_url }}">{{ post.title | escape }}</a>
        </li>
      {% endif %}
    {% endfor %}
  </ul>
{% endfor %}

<!-- MLSys Section -->
<h2 class="main-category-title" id="mlsys">MLSYS</h2>
{% for subcat in mlsys_subcategories %}
  <h3 class="subcategory-title" id="mlsys-{{ subcat | slugify }}">{{ subcat | capitalize }}</h3>
  <ul class="post-list-with-tags">
    {% for post in site.categories[subcat] %}
      {% if post.categories contains 'mlsys' %}
        <li>
          <span class="post-meta">{{ post.date | date: "%Y-%m-%d" }}</span>
          <a class="post-link" href="{{ post.url | relative_url }}">{{ post.title | escape }}</a>
        </li>
      {% endif %}
    {% endfor %}
  </ul>
{% endfor %}
