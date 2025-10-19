# PaperCache - Deep Notes 展示站点

🌐 **访问地址**: https://shenh10.github.io/papercache

这是 [Deep Notes](https://github.com/shenh10/deepnotes) 的自动化部署站点，展示AI/ML研究论文。

## 🔄 自动化部署

本仓库内容由 `deepnotes` 仓库自动生成和部署，无需手动维护。

## 📚 源仓库

- **源代码**: [shenh10/deepnotes](https://github.com/shenh10/deepnotes)
- **内容管理**: 所有内容更新请在源仓库进行

## 🛠️ 技术栈

- Jekyll 静态站点生成器
- GitHub Pages 托管
- Giscus 评论系统 (基于本仓库的Discussions)
- Google Analytics 访客统计

## 📊 内容分类

### 🤖 大语言模型 (LLM)
- **算法研究**: Transformer变体、注意力机制、强化学习
- **工程实践**: 训练优化、推理加速、系统设计

### 🎨 扩散模型
- **扩散过程**: 前向和反向扩散、噪声调度
- **应用领域**: 图像生成、文本到图像合成

### ⚙️ 机器学习系统
- **系统架构**: 分布式计算框架、资源管理
- **数据管理**: 数据流水线、特征存储

## 🖼️ 文章头图自动选择规则

本站使用两种方式为文章生成缩略图：

1. **服务端生成**：`scripts/gen_thumbs.py` 在构建时预生成缩略图到 `assets/images/thumbs/`
2. **客户端动态生成**：`assets/js/card-enhancements.js` 在浏览器中动态提取（当服务端缩略图不存在时）

两种实现使用**完全相同的规则**，选择逻辑如下：

### 选择优先级

1. **`<figure>` 标签优先**
   - 优先查找带有 annotation（figcaption/alt/title）的 `<figure>` 标签
   - Annotation 必须**以"图 X"、"Figure X"、"Fig. X"开头**（忽略大小写）
   - 示例：`图1：模型架构` ✓  |  `整体结构如图1所示` ✗

2. **邻居文本匹配**
   - 如果 `<figure>` 没有 annotation，检查其紧邻的文本节点
   - 邻居文本必须**以图标题开头**
   - 搜索规则：
     - 向后搜索：跳过 `<br>` 标签，遇到下一个 `<figure>` 或有内容的元素则停止
     - 向前搜索：跳过 `<br>` 标签，遇到 `<figure>`、`<p>` 标签或文本节点的父元素是 `<p>` 则停止

3. **段落回溯**
   - 查找以"图 X"、"Figure X"开头的 `<p>` 段落
   - 如果段落本身包含 `<img>` 标签，直接使用
   - 否则向前回溯查找最近的 `<img>` 或 `<figure>`

4. **特殊情况：段落内嵌图片**
   - 如果段落包含 `<img>` 且文本中包含"图 X"/"Figure X"（不一定在开头），也认为匹配
   - 适用于描述性段落中嵌入图片的情况

### 图片格式要求

- ✓ 支持：Data URI (`data:image/...`)
- ✓ 支持：HTTP/HTTPS URL
- ✓ 支持：File URL (`file://...`)
- ✗ 不支持：相对路径（如 `images/fig1.jpg`）

### 过滤规则

- 排除包含"表"、"table"、"公式"、"formula"、"equation"、"算法"的图片
- 每篇文章只选择第一个符合条件的图片
- 如果找不到合适的图片，使用兜底占位符

### 生成的缩略图

- 输出目录：`assets/images/thumbs/`
- 临时目录：`.thumb_tmp/`（用于下载/解码原图）
- 默认尺寸：320x200
- 格式：JPEG，质量85%
- 文件名：根据源URL哈希值生成

## 💬 参与讨论

欢迎在 [Discussions](https://github.com/shenh10/papercache/discussions) 中：

- 对论文内容进行讨论
- 提出问题和建议
- 分享相关资源

## 📞 联系方式

- GitHub: [@shenh10](https://github.com/shenh10)
- Email: thushenhan@gmail.com

---

_本站点由 GitHub Actions 自动维护_








