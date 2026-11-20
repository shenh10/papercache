import { defineConfig } from 'vite';
import { cpSync, existsSync } from 'node:fs';
import { HttpsProxyAgent } from 'https-proxy-agent';

// MathJax 整包放进 App，离线也能排公式（es5 组件按需动态加载扩展，所以拷整个目录）
function copyMathJax() {
  return {
    name: 'copy-mathjax',
    buildStart() {
      if (!existsSync('public/mathjax')) {
        // 只用 tex-svg：去掉语音（sre）、CHTML 输出和其它入口组件
        const skip = /(^|\/)(sre|chtml)(\/|\.js$)|(^|\/)(mml-|tex-chtml|tex-mml|tex-svg-full|latest|node-main)/;
        cpSync('node_modules/mathjax/es5', 'public/mathjax', {
          recursive: true,
          filter: (src) => !skip.test(src.replace(/^.*node_modules\/mathjax\/es5\/?/, '')),
        });
      }
    },
  };
}

export default defineConfig({
  plugins: [copyMathJax()],
  server: {
    // 浏览器里调试时没有原生 HTTP，经由 dev server 转发站点页面，绕开 CORS
    proxy: {
      '/__site': {
        target: 'https://www.papercache.org',
        changeOrigin: true,
        agent: process.env.https_proxy ? new HttpsProxyAgent(process.env.https_proxy) : undefined,
        rewrite: (path) => path.replace(/^\/__site/, ''),
      },
    },
  },
});
