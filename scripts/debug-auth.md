# 调试：登录按钮不显示

## 检查清单

### 1. 检查 Supabase 配置

在浏览器控制台（F12 → Console）运行：

```javascript
// 检查配置是否正确加载
console.log('siteConfig:', window.siteConfig);
console.log('Supabase client:', window.getSupabaseClient?.());
```

**预期结果**：
- `window.siteConfig.supabase` 应该包含 `url` 和 `anon_key`
- `window.getSupabaseClient()` 应该返回 Supabase 客户端对象

### 2. 检查用户菜单元素

```javascript
// 检查用户菜单元素是否存在
console.log('user-menu:', document.getElementById('user-menu'));
console.log('user-menu-guest:', document.getElementById('user-menu-guest'));
console.log('user-menu-authenticated:', document.getElementById('user-menu-authenticated'));
```

**预期结果**：所有元素都应该存在（不为 null）

### 3. 检查登录按钮显示状态

```javascript
// 检查登录按钮的显示状态
const guestMenu = document.getElementById('user-menu-guest');
console.log('登录按钮元素:', guestMenu);
console.log('显示状态:', guestMenu?.style.display);
console.log('计算样式:', window.getComputedStyle(guestMenu));
```

### 4. 手动显示登录按钮（临时调试）

```javascript
// 临时手动显示登录按钮
const guestMenu = document.getElementById('user-menu-guest');
if (guestMenu) {
  guestMenu.style.display = 'block';
  console.log('已手动显示登录按钮');
}
```

### 5. 检查页面源代码

查看页面源代码（View Source），检查：
- `<meta name="supabase-url">` 是否存在
- `<script src="supabase-client.js">` 是否加载
- `<script src="auth.js">` 是否加载
- `<script src="user-menu.js">` 是否加载

### 6. 检查网络请求

在浏览器开发者工具的 Network 标签中，检查：
- `supabase-client.js` 是否成功加载（状态码 200）
- `auth.js` 是否成功加载
- `user-menu.js` 是否成功加载

## 常见问题和解决方案

### 问题1：Supabase 配置为空
**症状**：`window.siteConfig.supabase` 为 undefined 或 url/key 为空

**解决**：
```bash
# 重新同步配置
./scripts/load-env-to-config.sh

# 重新启动 Jekyll 服务器
bundle exec jekyll serve --config _config.yml,_config_local.yml
```

### 问题2：JavaScript 文件未加载
**症状**：控制台显示 404 错误

**解决**：
- 检查文件路径是否正确
- 确保 Jekyll 构建成功
- 清除浏览器缓存

### 问题3：条件判断失败
**症状**：用户菜单元素不存在

**解决**：
- 检查 `site.supabase.enabled` 是否为 `true`
- 检查 `_config_local.yml` 中 `supabase.enabled` 的值

### 问题4：登录按钮被 CSS 隐藏
**症状**：元素存在但不可见

**解决**：
- 检查 CSS 样式
- 检查是否有其他样式覆盖了显示设置


