# 用户活跃度分析功能

## 功能概述

基于 Supabase 实现的用户活跃度分析系统，可以追踪和分析用户的浏览、搜索、收藏等行为，为运营决策提供数据支持。

## 已实现功能

### 1. 数据收集

- **页面浏览追踪**：自动记录用户访问的页面
- **搜索行为追踪**：记录用户的搜索关键词
- **收藏行为追踪**：记录用户的收藏/取消收藏操作
- **点击行为追踪**：记录用户点击的文章链接（通过 ClickTracker）

### 2. 数据分析

- **日活跃用户（DAU）**：统计每日活跃用户数
- **活跃用户趋势**：支持日期范围查询，查看活跃用户变化趋势
- **热门页面**：统计访问量最高的页面
- **搜索热词**：统计最常用的搜索关键词
- **用户留存率**：分析用户留存情况（1日、7日、30日留存）

### 3. 管理后台

在 `/admin/index.html` 的"数据分析"标签页中，可以：
- 查看今日/昨日/7日均值 DAU
- 按日期范围查询活跃用户趋势
- 查看热门页面排行榜
- 查看搜索热词排行榜

## 数据库结构

### `user_activity_logs` 表

记录用户的所有活动：
- `user_id`: 用户ID（已登录用户）
- `session_id`: 会话ID（匿名用户）
- `activity_type`: 活动类型（page_view, search, click, favorite）
- `page_path`: 页面路径
- `page_title`: 页面标题
- `search_query`: 搜索关键词
- `target_url`: 目标URL（点击或收藏的文章）
- `metadata`: 额外元数据（设备信息、屏幕尺寸等）

### `user_sessions` 表

追踪用户会话：
- `id`: 会话ID
- `user_id`: 用户ID（登录后关联）
- `first_seen_at`: 首次访问时间
- `last_seen_at`: 最后访问时间
- `page_views`: 页面浏览量

## PostgreSQL 函数

### 分析函数

1. **`get_daily_active_users(p_date)`**
   - 获取指定日期的活跃用户数

2. **`get_active_users_in_range(p_start_date, p_end_date)`**
   - 获取指定日期范围内的活跃用户数（按日分组）
   - 返回：日期、总用户数、已登录用户数、匿名用户数

3. **`get_popular_pages(p_start_date, p_end_date, p_limit)`**
   - 获取热门页面
   - 返回：页面路径、页面标题、访问次数、独立访客数

4. **`get_search_keywords(p_start_date, p_end_date, p_limit)`**
   - 获取搜索热词
   - 返回：搜索关键词、搜索次数、独立搜索用户数

5. **`get_user_retention(p_start_date, p_end_date)`**
   - 获取用户留存率
   - 返回：队列日期、总用户数、1日留存、7日留存、30日留存

### 记录函数

6. **`log_user_activity(...)`**
   - 记录用户活动并更新会话信息
   - 自动处理用户登录后会话关联

## 使用方法

### 1. 部署数据库

在 Supabase Dashboard 的 SQL Editor 中执行：
```sql
-- 执行 supabase-analytics.sql
\i scripts/supabase-analytics.sql
```

### 2. 启用前端追踪

分析服务会自动加载（通过 `head.html` 引入 `analytics-service.js`），无需额外配置。

### 3. 查看分析数据

1. 访问管理后台：`/admin/index.html`
2. 切换到"数据分析"标签页
3. 查看各项统计数据

## 隐私和性能考虑

### 隐私保护

- 匿名用户使用 `session_id` 追踪，不关联个人信息
- 用户登录后，会话自动关联到 `user_id`
- RLS 策略确保用户只能查看自己的活动记录（管理员可查看全部）

### 性能优化

- **批量处理**：活动记录使用队列批量提交，减少数据库请求
- **自动刷新**：队列每 5 秒自动刷新，或达到 10 条时立即刷新
- **页面卸载保护**：使用 `beforeunload` 事件确保数据不丢失
- **索引优化**：关键字段已建立索引，提高查询性能

## 扩展功能建议

### 短期（可快速实现）

1. **图表可视化**
   - 使用 Chart.js 或 ECharts 替换文本表格
   - 显示活跃用户趋势折线图
   - 显示搜索热词词云

2. **导出功能**
   - 支持导出 CSV/Excel 格式的分析报告

3. **实时监控**
   - WebSocket 或 Server-Sent Events 实现实时数据更新

### 中期（需要更多开发）

4. **用户画像**
   - 分析用户的兴趣偏好（基于收藏、搜索关键词）
   - 推荐相关文章

5. **漏斗分析**
   - 分析用户从访问到收藏的转化路径

6. **A/B 测试支持**
   - 追踪不同页面版本的效果

## 注意事项

1. **数据保留策略**：建议定期清理旧数据（如保留 90 天），避免表过大
2. **RLS 策略**：管理员需要调整 RLS 策略才能查看所有用户的活动数据
3. **IP 地址隐私**：考虑对 IP 地址进行哈希处理或脱敏

## 相关文件

- `scripts/supabase-analytics.sql` - 数据库表结构和函数
- `assets/js/analytics-service.js` - 前端活动追踪服务
- `assets/js/admin-analytics.js` - 管理后台分析服务
- `admin/index.html` - 管理后台页面（数据分析标签页）

