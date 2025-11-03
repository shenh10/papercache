# Vercel Functions 部署指南

## 🚀 快速开始

### 1. 注册 Vercel 账号
1. 访问 [https://vercel.com](https://vercel.com)
2. 点击 "Sign Up" 使用 GitHub 账号登录
3. 完成账号验证

### 2. 连接项目
```bash
# 在 papercache 目录下
cd /Users/niujianwei/Documents/coding/deep_notes/papercache

# 安装 Vercel CLI
npm install -g vercel

# 登录 Vercel
vercel login

# 连接项目
vercel link
```

### 3. 部署 API
```bash
# 部署到生产环境
vercel --prod

# 或者部署到预览环境
vercel
```

## 📁 项目结构

```
papercache/
├── api/                    # Vercel Functions
│   ├── search.js          # 搜索 API
│   ├── suggestions.js     # 搜索建议 API
│   └── stats.js           # 统计数据 API
├── assets/js/
│   └── enhanced-search.js # 前端搜索组件
├── vercel.json            # Vercel 配置
├── package.json           # Node.js 依赖
└── 05-search.html         # 搜索页面
```

## 🔧 API 端点

### 搜索 API
- **URL**: `/api/search`
- **方法**: GET, POST
- **功能**: 全文搜索论文

**GET 参数**:
```
q=搜索关键词
category=分类过滤
year=年份过滤
tag=标签过滤
limit=结果数量限制
```

**POST 请求体**:
```json
{
  "query": "transformer attention",
  "filters": {
    "categories": ["llm", "algorithm"],
    "dateRange": {
      "start": "2023-01-01",
      "end": "2024-12-31"
    },
    "tags": ["iclr24"]
  },
  "limit": 20
}
```

### 搜索建议 API
- **URL**: `/api/suggestions`
- **方法**: GET
- **功能**: 获取搜索建议和热门搜索

**参数**:
```
q=搜索关键词
limit=建议数量
type=建议类型
```

### 统计数据 API
- **URL**: `/api/stats`
- **方法**: GET
- **功能**: 获取论文统计数据

**参数**:
```
type=统计类型 (overview, categories, tags, trends, years)
```

## 🎨 前端集成

### 基础使用
```html
<!-- 在页面中引入搜索组件 -->
<script src="/assets/js/enhanced-search.js"></script>

<!-- 创建搜索容器 -->
<div class="search-container">
  <input type="text" id="search-input" placeholder="搜索论文...">
  <div id="search-suggestions"></div>
</div>
<div id="search-results"></div>
```

### 高级配置
```javascript
// 自定义配置
const search = new EnhancedSearch({
  apiBase: '/api',
  searchInput: '#my-search-input',
  resultsContainer: '#my-results',
  suggestionsContainer: '#my-suggestions'
});
```

## 🔍 搜索功能特性

### 1. 全文搜索
- 支持论文标题、摘要、分类搜索
- 使用 Lunr.js 提供强大的搜索算法
- 支持模糊匹配和相关性排序

### 2. 实时建议
- 输入时自动显示搜索建议
- 支持标题、分类、标签建议
- 显示匹配数量

### 3. 高级过滤
- 按分类过滤
- 按年份过滤
- 按标签过滤
- 组合过滤条件

### 4. 结果展示
- 相关性评分
- 论文元数据展示
- 响应式设计
- 点击跳转到论文详情

## 🛠️ 开发调试

### 本地开发
```bash
# 启动本地开发服务器
vercel dev

# 访问 http://localhost:3000
# API 端点: http://localhost:3000/api/search
```

### 查看日志
```bash
# 查看函数日志
vercel logs

# 查看特定函数日志
vercel logs --function=search
```

### 环境变量
```bash
# 设置环境变量
vercel env add NODE_ENV production

# 查看环境变量
vercel env ls
```

## 📊 性能优化

### 1. 缓存策略
- 搜索索引在内存中缓存
- 统计数据定期更新
- 静态文件使用 CDN 缓存

### 2. 响应优化
- 搜索结果分页
- 异步加载建议
- 防抖搜索输入

### 3. 错误处理
- 优雅降级
- 错误重试机制
- 用户友好的错误提示

## 🔒 安全考虑

### 1. CORS 配置
- 允许跨域请求
- 限制请求方法
- 设置安全头

### 2. 输入验证
- 搜索查询长度限制
- 特殊字符过滤
- SQL 注入防护

### 3. 速率限制
- API 调用频率限制
- 恶意请求检测
- 自动封禁机制

## 🚨 故障排除

### 常见问题

1. **API 返回 500 错误**
   - 检查数据文件是否存在
   - 查看 Vercel 函数日志
   - 验证依赖是否正确安装

2. **搜索无结果**
   - 确认数据文件格式正确
   - 检查搜索索引构建
   - 验证搜索查询格式

3. **前端搜索组件不工作**
   - 检查 JavaScript 控制台错误
   - 确认 API 端点可访问
   - 验证 DOM 元素选择器

### 调试命令
```bash
# 检查 Vercel 项目状态
vercel ls

# 查看项目详情
vercel inspect

# 重新部署
vercel --prod --force
```

## 📈 监控和分析

### 1. Vercel 仪表板
- 函数调用统计
- 响应时间监控
- 错误率分析

### 2. 自定义监控
```javascript
// 在 API 中添加监控
console.log('Search API called:', {
  query: req.query.q,
  timestamp: new Date().toISOString(),
  userAgent: req.headers['user-agent']
});
```

## 🔄 更新和维护

### 1. 代码更新
```bash
# 推送代码到 GitHub
git add .
git commit -m "Update search functionality"
git push

# Vercel 自动部署
```

### 2. 依赖更新
```bash
# 更新 package.json
npm update

# 重新部署
vercel --prod
```

### 3. 数据更新
- 数据文件更新后自动重新构建索引
- 无需手动干预
- 支持增量更新

## 📞 支持

如果遇到问题，可以：
1. 查看 Vercel 文档: https://vercel.com/docs
2. 检查 GitHub Issues
3. 联系技术支持

---

**注意**: 确保在生产环境中定期备份数据和监控性能指标。


