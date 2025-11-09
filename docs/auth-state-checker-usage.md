# 认证状态检查模块使用指南

## 概述

`auth-state-checker.js` 是一个统一的认证状态检查模块，所有页面都应该使用这个模块来检查登录状态，避免重复逻辑。

## API

### 1. `getQuick()` - 快速获取（同步）

```javascript
const user = window.authStateChecker.getQuick();
// 返回：用户对象或null
// 用途：最快的方式，从全局变量读取（几乎瞬间）
```

### 2. `getFromSession()` - 从session获取（异步）

```javascript
const user = await window.authStateChecker.getFromSession();
// 返回：Promise<用户对象或null>
// 用途：从localStorage读取session（很快）
```

### 3. `getFromService()` - 从authService获取（异步）

```javascript
const user = await window.authStateChecker.getFromService(timeoutMs);
// 返回：Promise<用户对象或null>
// 用途：从authService获取完整信息（包括profile，可能较慢）
```

### 4. `check()` - 统一检查（推荐）

```javascript
const user = await window.authStateChecker.check({
  waitForService: true,      // 是否等待authService初始化
  serviceTimeout: 3000,       // 等待authService的超时时间（毫秒）
  getUserTimeout: 5000        // authService.getCurrentUser的超时时间（毫秒）
});
// 返回：Promise<用户对象或null>
// 按优先级检查：全局状态 -> session -> authService
```

### 5. `updateUIImmediately()` - 立即更新UI

```javascript
const updated = window.authStateChecker.updateUIImmediately(
  (user) => {
    // 更新UI的回调函数
    console.log('用户已登录', user.email);
  },
  () => {
    // 错误回调（可选）
    console.log('未登录');
  }
);
// 返回：boolean（是否已更新）
// 用途：如果有全局状态，立即更新UI，避免页面闪烁
```

### 6. `onAuthStateChange()` - 注册状态监听器

```javascript
window.authStateChecker.onAuthStateChange((user, event) => {
  if (user) {
    console.log('登录状态变化', event, user.email);
  } else {
    console.log('登出', event);
  }
});
// 用途：监听认证状态变化，自动更新UI
```

## 使用示例

### 示例1：简单页面（只需要检查登录状态）

```javascript
// 页面加载时检查
document.addEventListener('DOMContentLoaded', async () => {
  const user = await window.authStateChecker.check();
  
  if (user) {
    console.log('用户已登录', user.email);
    // 显示页面内容
  } else {
    console.log('用户未登录');
    // 显示登录提示
  }
});
```

### 示例2：需要立即显示登录状态的页面

```javascript
// 立即更新UI（在DOM加载之前）
window.authStateChecker.updateUIImmediately((user) => {
  // 如果检测到全局状态，立即显示已登录状态
  showLoggedInUI(user);
});

// DOM加载后注册监听器
document.addEventListener('DOMContentLoaded', () => {
  window.authStateChecker.onAuthStateChange((user) => {
    if (user) {
      showLoggedInUI(user);
    } else {
      showLoggedOutUI();
    }
  });
});
```

### 示例3：需要完整用户信息的页面

```javascript
document.addEventListener('DOMContentLoaded', async () => {
  // 先快速更新UI（如果有全局状态）
  window.authStateChecker.updateUIImmediately(showBasicUI);
  
  // 然后获取完整信息
  const user = await window.authStateChecker.check({
    waitForService: true,
    getUserTimeout: 5000
  });
  
  if (user && user.profile) {
    showFullUI(user);
  }
});
```

## 优势

1. **统一逻辑**：所有页面使用相同的检查逻辑
2. **避免重复**：不需要在每个页面重复写检查代码
3. **性能优化**：按优先级检查，快速返回
4. **易于维护**：只需在一个地方修改逻辑
5. **类型安全**：提供清晰的API接口



