# 匿名用户追踪方案

## 问题分析

### 原有方案的问题
- 使用 `sessionStorage` 存储 `session_id`
- 标签页关闭后 `sessionStorage` 被清除
- 重新打开网站会生成新的 `session_id`
- **导致同一匿名用户被重复计算**

### 实际场景
1. 用户访问网站（匿名）→ 生成 `session_id_1`
2. 用户关闭标签页
3. 用户重新访问网站 → 生成 `session_id_2`
4. **结果**：同一个用户被统计为 2 个不同的匿名用户 ❌

## 现代网站的匿名用户追踪方案

### 1. **持久化访客ID（Cookie/localStorage）**
- **Google Analytics**: 使用 `_ga` cookie（2年有效期）
- **常见做法**: 使用 localStorage 存储访客ID，有效期1-2年
- **优点**: 跨会话追踪，准确度高
- **缺点**: 用户清除浏览器数据后会重新生成

### 2. **浏览器指纹（Browser Fingerprinting）**
- 组合 IP + User-Agent + 屏幕分辨率 + 时区等
- **优点**: 即使清除 cookie 也能识别
- **缺点**: 
  - 隐私问题（GDPR/CCPA合规性）
  - 同一设备不同浏览器会被识别为不同用户
  - 同一网络环境（如公司网络）多用户可能被识别为同一用户

### 3. **混合方案（推荐）**
- **主方案**: 持久化访客ID（localStorage/cookie）
- **辅助方案**: IP + User-Agent（用于去重和异常检测）
- **平衡**: 准确性和隐私保护

## 我们的改进方案

### ✅ 新方案：持久化访客ID

**实现方式**：
1. 使用 `localStorage` 存储访客ID（而不是 `sessionStorage`）
2. 访客ID有效期：**365天（1年）**
3. 过期后自动重新生成
4. 向后兼容：如果 localStorage 不可用，fallback 到 sessionStorage

**关键改进**：
```javascript
// 旧方案（sessionStorage）
sessionStorage.setItem('pc_session_id', sessionId);  // 标签页关闭即清除

// 新方案（localStorage + 过期机制）
localStorage.setItem('pc_visitor_id', visitorId);
localStorage.setItem('pc_visitor_id_expiry', expiryDate);  // 1年后过期
```

### 优势

1. **跨会话追踪**：用户关闭标签页后重新打开，仍然是同一个访客ID
2. **减少重复计算**：同一用户在1年内只算一个匿名用户
3. **符合行业标准**：与 Google Analytics 等主流工具的做法一致
4. **隐私友好**：1年后自动过期，用户可以清除浏览器数据重置

### 统计口径

**匿名用户的识别**：
- 当 `user_id IS NULL` 时，使用 `session_id`（实际存储的是访客ID）作为标识
- 同一个访客ID在同一天只统计一次（通过 `DISTINCT` 去重）

**DAU统计**：
- **已登录用户**：通过 `user_id` 标识（验证在 `profiles` 表中存在）
- **匿名用户**：通过访客ID（存储在 `session_id` 字段）标识
- **总DAU** = 已登录用户数 + 匿名用户数（都已去重）

## 数据迁移说明

### 现有数据
- 旧的 `session_id`（基于 sessionStorage）会继续存在
- 新访问会使用新的访客ID（基于 localStorage）

### 处理建议
1. **历史数据**：保留现有的 `session_id` 记录
2. **新数据**：使用新的访客ID机制
3. **统计函数**：已支持两种标识方式，无需修改

## 进一步优化建议（可选）

### 1. IP地址辅助去重
如果同一个IP在短时间内有多个不同的访客ID，可能是：
- 同一用户清除浏览器数据后重新访问
- 同一网络环境的不同用户

可以添加IP地址字段，用于异常检测和去重。

### 2. 设备指纹（可选，需注意隐私）
结合多个浏览器特征生成唯一指纹：
- User-Agent
- 屏幕分辨率
- 时区
- 语言设置

**注意**：需要符合 GDPR/CCPA 等隐私法规。

### 3. 跨设备追踪
如果需要追踪用户跨设备访问，通常需要：
- 用户登录（已登录用户天然支持）
- 或第三方服务（如 Google Analytics）

## 总结

✅ **当前方案**：使用 localStorage 存储访客ID（1年有效期）
- 解决了 sessionStorage 导致的重复计算问题
- 符合行业标准做法
- 隐私友好（1年过期）

📊 **统计准确性**：
- 已登录用户：通过 `user_id` 准确追踪
- 匿名用户：通过持久化访客ID追踪，减少重复计算

🎯 **下一步**：
1. 部署新的访客ID机制
2. 观察统计数据的变化
3. 如需进一步优化，可以考虑添加IP地址字段



