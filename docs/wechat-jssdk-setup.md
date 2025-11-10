# 微信 JS-SDK 配置指南

## 概述

微信 JS-SDK 允许在微信内置浏览器中实现自定义分享功能，包括分享到朋友圈和分享给好友。

## 配置步骤

### 1. 注册微信公众号并获取 AppID

1. 访问 [微信公众平台](https://mp.weixin.qq.com/)
2. 注册并认证一个公众号（服务号或订阅号）
3. **获取 AppID 和 AppSecret**：
   - 登录微信公众平台
   - 进入"开发" → "基本配置"
   - 在"开发者ID(AppID)"中可以看到你的 AppID
   - 在"开发者密码(AppSecret)"中点击"生成"或"重置"获取 AppSecret
   - ⚠️ **重要**：AppSecret 只显示一次，请妥善保存

### 2. 配置 JS 接口安全域名

1. 登录微信公众平台
2. 进入"设置" → "公众号设置" → "功能设置"
3. 在"JS接口安全域名"中添加你的域名（如：`shenh10.github.io`）
4. 注意：不需要加 `http://` 或 `https://`
5. **上传验证文件**：
   - 微信会提示你下载一个验证文件（如：`MP_verify_xxxxx.txt`）
   - 将验证文件放在项目根目录（`papercache/` 目录下）
   - 文件内容就是验证码本身（只有一行）
   - Jekyll 会自动将根目录的文件部署到网站根目录
   - 确保文件可以通过 `https://shenh10.github.io/papercache/MP_verify_xxxxx.txt` 访问
   - 示例：已创建 `MP_verify_fTEEJOO6vhq1nuQO.txt` 文件

### 3. 配置 _config.yml

在 `_config.yml` 中添加微信配置：

```yaml
wechat:
  enabled: true  # 启用微信JS-SDK
  app_id: "your_app_id_here"  # 你的微信公众号AppID
```

### 4. 创建后端 API（获取签名）

微信 JS-SDK 需要服务器端生成签名。你需要创建一个后端 API 来生成签名。

**⚠️ 重要**：由于微信签名需要服务器端生成（涉及 AppSecret），**必须使用后端服务**，不能完全依赖静态网站。

**API 路径**: `/api/wechat/jssdk-sign`

**后端服务选项**：

#### 选项1：使用 Vercel Functions（推荐，免费）
- 如果你已经有 Vercel 项目，可以直接在 `api/wechat/jssdk-sign.js` 创建函数
- 免费额度通常足够使用

#### 选项2：使用其他 Serverless 平台
- **Netlify Functions**：类似 Vercel，免费额度
- **Cloudflare Workers**：免费额度较大
- **AWS Lambda**：有免费额度
- **腾讯云 Serverless**：国内访问更快

#### 选项3：使用自己的服务器
- 如果有自己的服务器，可以部署 Node.js/Python 后端
- 需要配置 HTTPS 和域名

**请求参数**:
- `url`: 当前页面的完整URL（不包含#及其后面部分）

**响应格式**:
```json
{
  "success": true,
  "config": {
    "appId": "your_app_id",
    "timestamp": 1234567890,
    "nonceStr": "random_string",
    "signature": "generated_signature"
  }
}
```

**签名生成步骤**（需要在后端实现）:
1. 获取 `access_token`（使用 AppID 和 AppSecret）
2. 获取 `jsapi_ticket`（使用 access_token）
3. 生成随机字符串 `nonceStr`
4. 生成时间戳 `timestamp`
5. 按照微信规则生成签名：
   ```
   string1 = "jsapi_ticket=xxx&noncestr=xxx&timestamp=xxx&url=xxx"
   signature = sha1(string1)
   ```

### 5. 部署后端 API（生成签名）

由于 GitHub Pages 是静态网站，无法直接运行后端代码。你需要选择一个后端服务来生成微信签名。

#### 选项1：使用 Supabase Edge Functions（推荐，如果你已使用 Supabase）

**优势**：
- 与现有 Supabase 配置统一
- 免费额度充足
- 部署简单

**步骤**：

1. **安装 Supabase CLI**（如果还没有）：
   
   **macOS（推荐使用 Homebrew）**：
   ```bash
   brew install supabase/tap/supabase
   ```
   
   **其他平台**：
   - **Linux**: 下载二进制文件或使用包管理器
   - **Windows**: 使用 Scoop 或下载二进制文件
   - 详细安装方法：https://github.com/supabase/cli#install-the-cli
   
   **验证安装**：
   ```bash
   supabase --version
   ```

2. **登录 Supabase**：
   ```bash
   supabase login
   ```

3. **链接项目**：
   ```bash
   cd papercache
   supabase link --project-ref your-project-ref
   ```
   - `project-ref` 可以在 Supabase Dashboard → Settings → General 中找到

4. **部署 Edge Function**：
   ```bash
   supabase functions deploy wechat-jssdk-sign
   ```

5. **设置环境变量**：
   ```bash
   supabase secrets set WECHAT_APP_ID=your_app_id
   supabase secrets set WECHAT_APP_SECRET=your_app_secret
   ```
   
   或者通过 Supabase Dashboard：
   - 进入 Project Settings → Edge Functions → Secrets
   - 添加 `WECHAT_APP_ID` 和 `WECHAT_APP_SECRET`

6. **更新 `_config.yml`**：
   - 不需要修改 `api_base_url`，代码会自动使用 Supabase URL
   - 确保 `supabase.url` 已配置

**Edge Function 文件位置**：`supabase/functions/wechat-jssdk-sign/index.ts`

#### 选项2：使用其他 Serverless 平台

如果你不使用 Supabase Edge Functions，可以使用：

- **Vercel Functions**：将 `api/wechat/jssdk-sign.js` 部署到 Vercel
- **Netlify Functions**：类似 Vercel
- **Cloudflare Workers**：需要修改代码使用 Web Crypto API
- **AWS Lambda**：需要适配 Lambda 格式

**配置方式**：
- 在对应平台设置环境变量 `WECHAT_APP_ID` 和 `WECHAT_APP_SECRET`
- 更新 `_config.yml` 中的 `api_base_url` 指向你的 API 地址

## 后端 API 实现

已创建 API 文件：`api/wechat/jssdk-sign.js`

该文件支持：
- ✅ **Vercel Functions**（如果使用 Vercel）
- ✅ **Netlify Functions**（如果使用 Netlify）
- ✅ **其他支持 Node.js 的 Serverless 平台**

**重要**：如果你不使用 Vercel，需要：
1. 将 `api/wechat/jssdk-sign.js` 部署到你选择的后端平台
2. 更新 `_config.yml` 中的 `api_base_url` 指向你的后端地址
3. 在后端平台设置环境变量 `WECHAT_APP_ID` 和 `WECHAT_APP_SECRET`

## 测试

1. 在微信中打开你的网站
2. 点击分享按钮
3. 应该能够直接调用微信的分享功能

## 注意事项

1. **仅限微信浏览器**：JS-SDK 只在微信内置浏览器中有效
2. **需要 HTTPS**：生产环境必须使用 HTTPS
3. **域名配置**：必须在微信公众平台配置 JS 接口安全域名
4. **签名有效期**：jsapi_ticket 有效期为 7200 秒，建议缓存
5. **URL 匹配**：签名使用的 URL 必须与当前页面 URL 完全一致（不包含 # 及其后面部分）

## 故障排查

- **JS-SDK 未初始化**：检查后端 API 是否正常返回签名
- **配置失败**：检查 AppID 和域名配置是否正确
- **分享失败**：检查图片 URL 是否可访问（必须是 HTTPS）

