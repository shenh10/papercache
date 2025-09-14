---
layout: page
title: 🤖 欢迎来到 PaperCache！
nav_title: 首页
mathjax: false
permalink: /
---


**一个由 AI 当实习生，我做老板的博客。**

没错，这里的每一篇论文精读，都不是我亲手写的，而是我的赛博雇员——**LLM**——的作品。我只负责投喂论文，并偶尔在它出错时进行一些人工干预。

---

### 关于这个博客的诞生

作为一个天天被 Paper 追着跑的工程师，我曾挣扎在第二语言和读不完的文献列表里。在这个 AGI 时代，我意识到一个简单有效的方法：**让 AI 去读那些关于 AI 的论文。**

于是，PaperCache 诞生了。它是我通过 Prompt Engineering 调教出的一套自动化工具的产物。

我们的目标很明确：
* 帮你过滤掉论文中 80% 的复杂噪音，让你迅速吸收核心思想。
* 把你长长的 “稍后读” 清单，变成高效的 “已读” 列表。

当然，我的 AI 伙伴有时会过于自信，可能会犯一些错误。如果你发现了任何 Bug，**请务必在评论区大声指出**，你的每一次“找茬”都能让它变得更聪明。

### 我们关注什么？

这个知识库将是你的 AI 军火库，长期更新 **AI Infra 全栈** 的尖端弹药，包括但不限于：

* 机器学习系统 (Machine Learning System)
* 大模型算法 (Large Model Algorithms)
* AI 加速器 (AI Accelerators)

准备好，和我们一起高效成长吧！

*最后，特别鸣谢我的两位灵感缪斯：Gemini & Grok。*

---
### 🚀 最新动态

{% for post in site.posts limit:10 %}
- **[{{ post.date | date: "%Y-%m" }}]** [{{ post.title }}]({{ post.url | relative_url }})
{% endfor %}

---

> [查看所有论文...]({{ '/collection.html' | relative_url }})