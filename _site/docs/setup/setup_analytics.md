# 访客统计系统配置指南

为您的博客配置多层次的访客统计和分析功能，从轻量级计数器到专业分析工具。

## 📊 推荐统计方案组合

### 🥇 主推方案：Google Analytics 4 + 不蒜子

- **GA4**：专业详细的访客行为分析
- **不蒜子**：轻量级的实时访问计数

### 🥈 隐私友好方案：Plausible + 不蒜子

- **Plausible**：注重隐私的现代分析工具
- **不蒜子**：简单的访问统计显示

### 🥉 极简方案：仅不蒜子

- 适合不需要复杂分析的场景
- 对网站性能影响最小

## 🚀 快速配置

### 1. Google Analytics 4 (推荐)

#### 第一步：创建 GA4 账户

1. 访问 [Google Analytics](https://analytics.google.com/)
2. 点击 "开始测量"
3. 创建账户和媒体资源：
   - **账户名称**: `Deep Notes Blog`
   - **媒体资源名称**: `Deep Notes`
   - **网站 URL**: `https://shenh10.github.io/deepnotes`
   - **行业类别**: `科学和教育`
   - **时区**: `中国标准时间`

#### 第二步：获取测量ID

1. 在 GA4 中点击 "管理" ⚙️
2. 选择 "数据流"
3. 点击您的网站数据流
4. 复制 **测量 ID** (格式: `G-XXXXXXXXXX`)

#### 第三步：在 Jekyll 中配置

更新 `_config.yml`:

```yaml
# Google Analytics 4
google_analytics: "G-YOUR-MEASUREMENT-ID"
```

GA4 会自动通过 `_includes/analytics.html` 加载。

#### 第四步：验证安装

1. 部署更新后的网站
2. 访问您的网站
3. 在 GA4 的 "实时" 报告中查看是否有访客数据

### 2. 不蒜子计数器 (极简统计)

#### 配置方法

在 `_config.yml` 中启用：

```yaml
# 不蒜子计数器
busuanzi_analytics: true
```

不蒜子会自动在页脚显示：

- 📊 本站总访问量
- 👥 本站访客数

#### 自定义显示

可以在任何页面添加计数器：

```html
<!-- 页面访问量 -->
<span id="busuanzi_container_page_pv">
  本文阅读量<span id="busuanzi_value_page_pv"></span>次
</span>

<!-- 站点访问量 -->
<span id="busuanzi_container_site_pv">
  本站总访问量<span id="busuanzi_value_site_pv"></span>次
</span>

<!-- 站点访客数 -->
<span id="busuanzi_container_site_uv">
  本站访客数<span id="busuanzi_value_site_uv"></span>人次
</span>
```

### 3. Plausible Analytics (隐私友好)

#### 第一步：注册 Plausible

1. 访问 [Plausible.io](https://plausible.io/)
2. 注册账户 (有30天免费试用)
3. 添加您的网站域名

#### 第二步：在 Jekyll 中配置

更新 `_config.yml`:

```yaml
# Plausible Analytics
plausible:
  domain: "shenh10.github.io"
  src: "https://plausible.io/js/script.js"
```

#### 第三步：自托管 (可选)

如果要自托管 Plausible：

```yaml
plausible:
  domain: "shenh10.github.io"
  src: "https://your-plausible-instance.com/js/script.js"
```

### 4. Umami Analytics (开源替代)

#### 使用 Vercel 部署 Umami

1. Fork [Umami GitHub 仓库](https://github.com/umami-software/umami)
2. 在 Vercel 中导入项目
3. 配置环境变量：
   ```
   DATABASE_URL=postgresql://...
   HASH_SALT=your-random-salt
   ```

#### 在 Jekyll 中配置

```yaml
# Umami Analytics
umami:
  src: "https://your-umami-instance.vercel.app/script.js"
  website_id: "your-website-id"
  domains: "shenh10.github.io"
```

## 📈 高级配置

### Google Analytics 4 增强配置

#### 自定义事件追踪

在 `_includes/analytics.html` 中添加：

```html
<script>
  // 文件下载追踪
  document.addEventListener("click", function (e) {
    if (e.target.matches('a[href$=".pdf"], a[href$=".zip"], a[href$=".doc"]')) {
      gtag("event", "file_download", {
        file_name: e.target.href.split("/").pop(),
        link_url: e.target.href,
      });
    }
  });

  // 外链点击追踪
  document.addEventListener("click", function (e) {
    if (
      e.target.matches(
        'a[href^="http"]:not([href*="' + location.hostname + '"])',
      )
    ) {
      gtag("event", "click", {
        event_category: "outbound",
        event_label: e.target.href,
      });
    }
  });

  // 搜索追踪 (如果有搜索功能)
  function trackSearch(query) {
    gtag("event", "search", {
      search_term: query,
    });
  }

  // 页面滚动深度追踪
  let scrollTracked = false;
  window.addEventListener("scroll", function () {
    if (!scrollTracked && window.scrollY > document.body.scrollHeight * 0.75) {
      gtag("event", "scroll", {
        event_category: "engagement",
        event_label: "75%",
      });
      scrollTracked = true;
    }
  });
</script>
```

#### 电子商务追踪 (如果适用)

```javascript
// 博客文章阅读完成追踪
function trackReadComplete(articleTitle) {
  gtag("event", "read_complete", {
    event_category: "engagement",
    event_label: articleTitle,
    value: 1,
  });
}
```

### 统计数据隐私保护

#### IP 匿名化 (GA4)

在 GA4 配置中：

```javascript
gtag("config", "G-YOUR-ID", {
  anonymize_ip: true,
  allow_google_signals: false,
  allow_ad_personalization_signals: false,
});
```

#### Cookie 同意管理

添加简单的 Cookie 横幅：

```html
<!-- Cookie 同意横幅 -->
<div id="cookie-banner" style="display: none;">
  <div class="cookie-notice">
    <p>
      本站使用 Cookie 来改善用户体验。继续使用本站表示您同意我们的隐私政策。
    </p>
    <button onclick="acceptCookies()">接受</button>
    <button onclick="declineCookies()">拒绝</button>
  </div>
</div>

<script>
  function showCookieBanner() {
    if (!localStorage.getItem("cookieConsent")) {
      document.getElementById("cookie-banner").style.display = "block";
    }
  }

  function acceptCookies() {
    localStorage.setItem("cookieConsent", "accepted");
    document.getElementById("cookie-banner").style.display = "none";
    // 初始化分析工具
    initAnalytics();
  }

  function declineCookies() {
    localStorage.setItem("cookieConsent", "declined");
    document.getElementById("cookie-banner").style.display = "none";
  }

  // 页面加载时检查
  document.addEventListener("DOMContentLoaded", function () {
    const consent = localStorage.getItem("cookieConsent");
    if (consent === "accepted") {
      initAnalytics();
    } else if (!consent) {
      showCookieBanner();
    }
  });
</script>
```

## 📱 统计数据可视化

### 创建统计页面

创建 `stats.md` 页面显示访问统计：

```markdown
---
layout: page
title: "网站统计"
permalink: /stats/
---

# 📊 网站访问统计

<div class="stats-dashboard">
  <!-- 不蒜子统计 -->
  <div class="stat-card">
    <h3>📈 访问统计</h3>
    <p>总访问量: <span id="busuanzi_value_site_pv">-</span> 次</p>
    <p>访客数: <span id="busuanzi_value_site_uv">-</span> 人</p>
  </div>
  
  <!-- 文章统计 -->
  <div class="stat-card">
    <h3>📝 内容统计</h3>
    <p>文章总数: {{ site.posts.size }} 篇</p>
    <p>分类数: {{ site.categories.size }} 个</p>
    <p>标签数: {{ site.tags.size }} 个</p>
  </div>
  
  <!-- 最新文章 -->
  <div class="stat-card">
    <h3>🆕 最新文章</h3>
    {% for post in site.posts limit:5 %}
    <p><a href="{{ post.url }}">{{ post.title }}</a></p>
    {% endfor %}
  </div>
</div>

<style>
.stats-dashboard {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  margin: 20px 0;
}

.stat-card {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.stat-card h3 {
  margin-top: 0;
  color: #495057;
}
</style>
```

### GA4 数据导出

创建定期数据导出脚本：

```python
# scripts/export_analytics.py
from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import RunReportRequest
import os

def export_ga4_data():
    client = BetaAnalyticsDataClient()

    request = RunReportRequest(
        property=f"properties/{os.getenv('GA4_PROPERTY_ID')}",
        dimensions=[
            {"name": "date"},
            {"name": "pagePath"},
            {"name": "pageTitle"}
        ],
        metrics=[
            {"name": "activeUsers"},
            {"name": "screenPageViews"},
            {"name": "averageSessionDuration"}
        ],
        date_ranges=[{
            "start_date": "30daysAgo",
            "end_date": "today"
        }]
    )

    response = client.run_report(request)

    # 处理响应数据
    for row in response.rows:
        print(f"Date: {row.dimension_values[0].value}")
        print(f"Page: {row.dimension_values[1].value}")
        print(f"Views: {row.metric_values[1].value}")

if __name__ == "__main__":
    export_ga4_data()
```

## 🔍 故障排除

### 常见问题

#### GA4 数据不显示

1. **检查测量ID**: 确认 `G-XXXXXXXXXX` 格式正确
2. **检查网络**: 确认可以加载 `gtag.js`
3. **等待时间**: GA4 数据有 24-48 小时延迟
4. **调试模式**: 在浏览器开发者工具中检查网络请求

#### 不蒜子计数异常

1. **网络问题**: 检查是否能访问 `busuanzi.ibruce.info`
2. **元素冲突**: 确认 ID 没有重复
3. **缓存问题**: 清除浏览器缓存重试

#### Plausible 数据缺失

1. **域名配置**: 确认域名设置正确
2. **脚本加载**: 检查脚本是否正确加载
3. **广告拦截**: 某些广告拦截器会阻止分析脚本

### 性能优化

#### 异步加载

确保所有分析脚本都异步加载：

```html
<script async src="..."></script>
```

#### 预连接

添加预连接提升加载速度：

```html
<link rel="preconnect" href="https://www.google-analytics.com" />
<link rel="preconnect" href="https://googletagmanager.com" />
<link rel="dns-prefetch" href="//busuanzi.ibruce.info" />
```

#### 条件加载

根据环境条件加载：

```html
{% if jekyll.environment == 'production' %} {% include analytics.html %} {%
endif %}
```

## 📊 分析建议

### 关键指标监控

1. **页面浏览量 (PV)**: 整体流量趋势
2. **独立访客 (UV)**: 用户增长情况
3. **平均会话时长**: 内容质量指标
4. **跳出率**: 用户参与度
5. **热门页面**: 受欢迎的内容

### 定期分析报告

建议每月生成分析报告：

1. 访问量趋势分析
2. 热门文章排行
3. 用户来源分析
4. 设备和浏览器统计
5. 搜索关键词分析

## 🔗 相关资源

- [Google Analytics 4 文档](https://developers.google.com/analytics/devguides/collection/ga4)
- [Plausible 文档](https://plausible.io/docs)
- [Umami 文档](https://umami.is/docs)
- [不蒜子使用说明](http://ibruce.info/2015/04/04/busuanzi/)
- [Jekyll Analytics 插件](https://github.com/hendrikschneider/jekyll-analytics)

