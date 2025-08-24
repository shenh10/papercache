---
layout: page
title: "Deep Notes - 机器学习与AI资源"
description: "深度学习、机器学习和人工智能研究论文与笔记的完整集合"
---

# 欢迎来到 Deep Notes

一个关于**深度学习**、**机器学习**和**人工智能**的完整笔记、教程和资源集合。

## 🔍 最新内容

{% for post in site.posts limit:10 %}
- **[{{ post.date | date: "%Y-%m" }}] [{{ post.title }}]({{ post.url }})** - {{ post.description }}
{% endfor %}

## 📚 分类浏览

### 🤖 大语言模型 (LLM)
- **算法研究**: Transformer变体、注意力机制、位置编码、强化学习
- **工程实践**: 训练优化、推理加速、系统设计

### 🎨 扩散模型
- **扩散过程**: 前向和反向扩散、噪声调度
- **应用领域**: 图像生成、文本到图像合成、音频生成

### ⚙️ 机器学习系统
- **系统架构**: 分布式计算框架、资源管理
- **数据管理**: 数据流水线、特征存储、数据版本控制

## 🏷️ 标签云

{% assign tags = site.tags | sort %}
{% for tag in tags %}
  {% assign t = tag | first %}
  <a href="/tags/#{{t | downcase | replace:" ","-"}}">{{t}}</a>
{% endfor %}

---

*本集合持续更新AI和机器学习领域的最新研究和见解。*
