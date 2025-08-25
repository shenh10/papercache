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

{% for main_cat_entry in site.data.collection_structure %}
  {% assign main_cat_name = main_cat_entry[0] %}
  {% assign sub_cats = main_cat_entry[1] %}
  <h2 class="main-category-title" id="{{ main_cat_name | slugify }}">{{ main_cat_name | upcase }}</h2>
  
  {% for sub_cat_entry in sub_cats %}
    {% assign sub_cat_name = sub_cat_entry[0] %}
    {% assign sub_sub_cats = sub_cat_entry[1] %}
    <h3 class="subcategory-title" id="{{ main_cat_name | slugify }}-{{ sub_cat_name | slugify }}">{{ sub_cat_name | capitalize }}</h3>
    
    {% for sub_sub_cat_entry in sub_sub_cats %}
      {% assign sub_sub_cat_name = sub_sub_cat_entry[0] %}
      {% assign posts = sub_sub_cat_entry[1] %}
      <h4 class="sub-subcategory-title" id="{{ main_cat_name | slugify }}-{{ sub_sub_cat_name | slugify }}">{{ sub_sub_cat_name | replace: "_", " " | capitalize }}</h4>
      <ul class="post-list-with-tags">
        {% for post in posts %}
          <li>
            <span class="post-meta">{{ post.date | date: "%Y-%m-%d" }}</span>
            <a class="post-link" href="{{ post.url | relative_url }}">{{ post.title | escape }}</a>
          </li>
        {% endfor %}
      </ul>
    {% endfor %}
  {% endfor %}
{% endfor %}