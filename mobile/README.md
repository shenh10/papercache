# PaperCache 手机 App（Capacitor）

原生安卓 App：书架（继续阅读 / 收藏 / 已下载）、发现（目录 + 搜索）、离线阅读、从上次位置继续。

## 数据从哪来

- 论文目录：Supabase `posts_search` 表（匿名可读），缓存在 App 文件目录，离线也能浏览。
- 演示文稿：`/slides/` 合集页面解析成同构条目（88 篇），与论文一样可搜索、按多级分类下钻、离线阅读。
- 文章正文：用原生 HTTP 取 papercache.org 页面，抽出 `.post-content`。图片是 base64 内联的，正文就是完整的一篇。
- 收藏：和网站共用 Supabase 账号与 `favorites` 表；读到 90% 自动标记已读（`is_read`）。
- 资料：读网站 `profiles` 表，显示用户名和头像；管理员账号在「我的」页提供网站后台入口。
- 下载：正文写成 App 数据目录下的 HTML 文件；MathJax（tex-svg）打包在 App 里，离线照常排公式。
- 阅读进度：记「最近的章节标题 + 在该节里的比例」，换字号也能回到同一段；目前只存本机。

## 开发

```bash
cp .env.example .env.local   # 填 Supabase URL 和 anon key（与站点页面 meta 中的一致）
npm install
npm run dev                  # 浏览器调试，/__site 经 dev server 转发站点页面
```

## 打包安卓

需要 Node 22、JDK 21、Android SDK（platform 36）。

```bash
npm run sync                 # vite build + cap sync android
cd android && ./gradlew assembleDebug
# 产物：android/app/build/outputs/apk/debug/app-debug.apk
```

GitHub 登录回跳 `org.papercache.app://auth-callback`，需要在 Supabase Dashboard → Authentication → URL Configuration 的 Redirect URLs 里加上这个地址。

## 发布

推到 main 且改动了 `mobile/` 时，`.github/workflows/android-release.yml` 会：

1. 用 Secrets 里的正式 keystore 打包签名 APK，版本号 = `package.json` 的 version，构建号 = workflow run number；
2. 发一个 `app-v<version>-build<N>` 的 GitHub Release，附 `PaperCache.apk`；
3. 触发站点部署。`deploy-pages.yml` 把最新的 App Release 拷到 `_site/download/PaperCache.apk` 并写 `download/app.json`；导航栏「App」页（`06-app.html`）和 App 内的「检查更新」都读这两个文件。

## 应用内自动更新

App 启动和回到前台时检查 `download/app.json`；发现有新 build：

1. 默认在后台直接下载 APK（站点直链带 CORS 头，WebView 里 fetch 流式下载，有进度），存缓存目录；
2. 下载完成弹提示，点「安装」调起系统安装器（`ApkInstallerPlugin`，走 FileProvider + `ACTION_VIEW`）；
3. 首次安装系统会要求允许「PaperCache 安装未知应用」（`REQUEST_INSTALL_PACKAGES`），允许后回来再点一次「安装」即可；
4. 「我的」页可以关闭「有新版本时自动下载」，改为手动点「下载并安装」；下载失败时有「浏览器下载」兜底。

下载前会校验文件头是 zip（`PK`），避免站点用 HTML 兜底 404 时装到坏包。

需要的 Secrets（除了站点已有的 `SUPABASE_URL` / `SUPABASE_ANON_KEY`）：

| Secret | 内容 |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 papercache-release.jks` |
| `ANDROID_KEYSTORE_PASSWORD` | keystore 密码 |
| `ANDROID_KEY_ALIAS` | `papercache` |
| `ANDROID_KEY_PASSWORD` | key 密码 |

keystore 一旦丢失，已安装的用户就无法覆盖升级，只能卸载重装。务必另外备份。

