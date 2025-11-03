# 现代点击统计方案对比

## 当前方案 vs 现代方案

### 当前方案（直接写入）

**优点：**
- ✅ 实现简单，易于理解
- ✅ 数据实时性高
- ✅ 使用 PostgreSQL 函数保证原子性

**缺点：**
- ❌ 每次点击都立即写入，高并发时性能差
- ❌ 页面跳转可能导致请求丢失
- ❌ 没有批处理，无法优化网络请求
- ❌ 没有本地缓存，离线时数据丢失

---

### 现代方案（批处理 + 本地队列）

**优点：**
- ✅ **批处理聚合**：减少数据库写入次数，提高性能
- ✅ **本地队列**：使用 localStorage 持久化，刷新不丢失
- ✅ **sendBeacon API**：页面卸载时也能发送数据
- ✅ **自动重试**：失败的项目自动重试
- ✅ **页面可见性优化**：只在页面可见时刷新，节省资源

**缺点：**
- ⚠️ 实现更复杂
- ⚠️ 数据有轻微延迟（最多5秒）
- ⚠️ 需要额外的 localStorage 空间

---

## 进一步优化方向

### 1. 使用 Redis/消息队列
```javascript
// 前端 → Redis Queue → Worker → 数据库
// 适用于高并发场景
```

### 2. 时间窗口聚合
```sql
-- 按小时/天聚合点击数据，减少存储
CREATE TABLE post_clicks_hourly (
  post_url TEXT,
  hour TIMESTAMP,
  click_count INTEGER
);
```

### 3. CDN/边缘函数
```javascript
// 使用 Cloudflare Workers / Vercel Edge Functions
// 在边缘节点处理点击统计，延迟更低
```

### 4. 事件溯源
```javascript
// 记录所有点击事件，而不是只存储计数
// 可以后续分析用户行为模式
```

---

## 推荐方案

对于中小型网站（如 PaperCache），推荐使用：
1. **批处理 + localStorage 队列**（已实现）
2. **sendBeacon 降级**（已实现）
3. **PostgreSQL 原子函数**（已实现）

这个组合在简单性和性能之间取得了很好的平衡。

对于大型网站，可以考虑：
- Redis 队列
- 专门的 Analytics 服务（如 Google Analytics, Plausible）
- 时间序列数据库（如 InfluxDB）

