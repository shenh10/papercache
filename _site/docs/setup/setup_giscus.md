# Giscus 评论系统配置指南

Giscus 是基于 GitHub Discussions 的评论系统，是 GitHub Pages 博客的最佳选择。

## 🎯 为什么选择 Giscus？

- ✅ **完全免费**：基于 GitHub Discussions，无需额外费用
- ✅ **数据安全**：评论数据存储在您自己的 GitHub 仓库中
- ✅ **无广告**：纯净的评论体验，无第三方广告
- ✅ **GitHub 集成**：访客可直接使用 GitHub 账号登录
- ✅ **支持 Markdown**：支持代码高亮、数学公式等
- ✅ **多语言支持**：支持中文界面
- ✅ **主题定制**：支持亮色/暗色主题切换

## 📋 配置步骤

### 第一步：启用 GitHub Discussions

1. 进入您的**公开仓库** `shenh10.github.io`
2. 点击 **Settings** 选项卡
3. 向下滚动到 **Features** 部分
4. 勾选 **Discussions** 复选框
5. 点击 **Set up discussions**

### 第二步：安装 Giscus 应用

1. 访问 [GitHub Apps - giscus](https://github.com/apps/giscus)
2. 点击 **Install**
3. 选择 **Only select repositories**
4. 选择您的公开仓库 `shenh10.github.io`
5. 点击 **Install**

### 第三步：配置 Giscus

1. 访问 [Giscus 配置页面](https://giscus.app/zh-CN)
2. 填写配置信息：

#### 仓库配置

```
仓库: shenh10/shenh10.github.io
```

#### 页面 ↔️ discussion 映射关系

选择：**Discussion 的标题包含页面的 pathname**

#### Discussion 分类

建议选择：**General** (或创建专门的 "Comments" 分类)

#### 特性

- ✅ 启用反应
- ✅ 懒加载评论
- ⭕ 将评论框放在评论上方（可选）

#### 主题

选择：**GitHub Light** 或 **Auto (推荐)**

### 第四步：获取配置代码

配置完成后，Giscus 会生成类似这样的代码：

```html
<script
  src="https://giscus.app/client.js"
  data-repo="shenh10/shenh10.github.io"
  data-repo-id="R_kgDOxxxxxxx"
  data-category="General"
  data-category-id="DIC_kwDOxxxxxxx"
  data-mapping="pathname"
  data-strict="0"
  data-reactions-enabled="1"
  data-emit-metadata="0"
  data-input-position="bottom"
  data-theme="preferred_color_scheme"
  data-lang="zh-CN"
  crossorigin="anonymous"
  async
></script>
```

### 第五步：更新 Jekyll 配置

将获取的配置信息更新到 `_config.yml` 中：

```yaml
# 评论系统配置
giscus:
  repo: "shenh10/shenh10.github.io"
  repo_id: "R_kgDOxxxxxxx" # 替换为实际的 repo_id
  category: "General"
  category_id: "DIC_kwDOxxxxxxx" # 替换为实际的 category_id
  mapping: "pathname"
  strict: "0"
  reactions_enabled: "1"
  input_position: "bottom"
  theme: "preferred_color_scheme"
  lang: "zh-CN"
```

## 🎨 自定义样式

您可以在 CSS 中自定义 Giscus 的外观：

```css
/* 评论区整体样式 */
.giscus {
  margin-top: 2em;
}

/* 评论框样式 */
.giscus-frame {
  border-radius: 8px;
  border: 1px solid #e1e4e8;
}

/* 暗色主题适配 */
@media (prefers-color-scheme: dark) {
  .giscus-frame {
    border-color: #30363d;
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .giscus {
    margin-top: 1.5em;
  }
}
```

## 🔧 高级配置

### 自动主题切换

如果您的网站支持主题切换，可以动态更改 Giscus 主题：

```javascript
// 主题切换函数
function setGiscusTheme(theme) {
  const iframe = document.querySelector("iframe.giscus-frame");
  if (iframe) {
    iframe.contentWindow.postMessage(
      { giscus: { setConfig: { theme } } },
      "https://giscus.app",
    );
  }
}

// 监听主题变化
document.addEventListener("themeChanged", (e) => {
  setGiscusTheme(e.detail.theme);
});
```

### 预加载 Discussions

为了提高加载速度，可以预加载 discussions：

```html
<link rel="preconnect" href="https://giscus.app" />
<link rel="dns-prefetch" href="https://giscus.app" />
```

### 自定义 Discussion 分类

建议创建专门的评论分类：

1. 进入您的仓库的 **Discussions** 页面
2. 点击右侧的 **✏️ Edit categories**
3. 点击 **New category**
4. 设置：
   - **Category name**: `博客评论`
   - **Description**: `博客文章的评论和讨论`
   - **Format**: `Open-ended discussion`
5. 点击 **Create**

## 📊 评论数据管理

### 导出评论数据

评论数据存储在 GitHub Discussions 中，可以通过 GitHub API 导出：

```bash
# 使用 GitHub CLI 导出 discussions
gh api repos/shenh10/shenh10.github.io/discussions --paginate > discussions.json
```

### 评论审核

作为仓库所有者，您可以：

- 删除不当评论
- 锁定 discussions
- 设置 discussion 的可见性
- 标记为已解答（如果适用）

### 垃圾评论防护

GitHub 自带垃圾评论过滤，但您也可以：

1. 设置仓库为 public，但 discussions 需要账号登录
2. 启用 IP 地址限制（通过 GitHub 设置）
3. 设置关键词过滤（需要自定义脚本）

## 🐛 常见问题解决

### 评论不显示

1. **检查网络**：确认可以访问 `giscus.app`
2. **检查配置**：验证 `repo_id` 和 `category_id` 是否正确
3. **检查权限**：确认仓库是 public 且启用了 Discussions
4. **清除缓存**：尝试清除浏览器缓存或使用无痕模式

### 主题不匹配

1. 确认 `data-theme` 设置正确
2. 检查网站的主题切换是否正确调用了 Giscus API
3. 验证 CSS 是否有冲突

### 加载缓慢

1. 添加 DNS 预连接：`<link rel="preconnect" href="https://giscus.app">`
2. 启用懒加载：确认 `data-loading="lazy"` 已设置
3. 考虑使用 CDN 或本地缓存

## 📈 评论统计

虽然 Giscus 本身不提供详细统计，但您可以通过 GitHub API 获取：

```javascript
// 获取评论统计
async function getCommentStats() {
  const response = await fetch(
    "https://api.github.com/repos/shenh10/shenh10.github.io/discussions",
  );
  const discussions = await response.json();

  return {
    total: discussions.length,
    withComments: discussions.filter((d) => d.comments > 0).length,
    totalComments: discussions.reduce((sum, d) => sum + d.comments, 0),
  };
}
```

## 🔄 从其他评论系统迁移

### 从 Disqus 迁移

目前没有自动迁移工具，但可以：

1. 导出 Disqus 评论数据
2. 手动在相应的 discussions 中添加历史评论
3. 在文章中添加迁移说明

### 从 Gitalk 迁移

1. 导出 GitHub Issues 中的评论
2. 转换为 Discussions 格式
3. 使用 GitHub API 批量创建

## 📚 相关资源

- [Giscus 官方文档](https://giscus.app/)
- [GitHub Discussions 文档](https://docs.github.com/en/discussions)
- [GitHub GraphQL API](https://docs.github.com/en/graphql)
- [Jekyll 集成指南](https://jekyllrb.com/docs/liquid/)

