// 微信 JS-SDK 签名生成 API
// 适用于 Vercel Functions、Netlify Functions、Cloudflare Workers 等

// 注意：如果使用 Cloudflare Workers，需要修改导入方式
// Cloudflare Workers 使用 Web Crypto API，不是 Node.js 的 crypto 模块

export default async function handler(req, res) {
  // 支持 GET 和 POST 请求
  const url = req.query?.url || req.body?.url;
  
  if (!url) {
    return res.status(400).json({
      success: false,
      error: '缺少 url 参数'
    });
  }

  const appId = process.env.WECHAT_APP_ID;
  const appSecret = process.env.WECHAT_APP_SECRET;

  if (!appId || !appSecret) {
    return res.status(500).json({
      success: false,
      error: '微信配置未设置，请检查环境变量 WECHAT_APP_ID 和 WECHAT_APP_SECRET'
    });
  }

  try {
    // 1. 获取 access_token
    const tokenUrl = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`;
    const tokenRes = await fetch(tokenUrl);
    const tokenData = await tokenRes.json();

    if (tokenData.errcode) {
      return res.status(500).json({
        success: false,
        error: `获取 access_token 失败: ${tokenData.errmsg || '未知错误'}`,
        errcode: tokenData.errcode
      });
    }

    const accessToken = tokenData.access_token;

    // 2. 获取 jsapi_ticket
    const ticketUrl = `https://api.weixin.qq.com/cgi-bin/ticket/getticket?type=jsapi&access_token=${accessToken}`;
    const ticketRes = await fetch(ticketUrl);
    const ticketData = await ticketRes.json();

    if (ticketData.errcode !== 0) {
      return res.status(500).json({
        success: false,
        error: `获取 jsapi_ticket 失败: ${ticketData.errmsg || '未知错误'}`,
        errcode: ticketData.errcode
      });
    }

    const jsapiTicket = ticketData.ticket;

    // 3. 生成签名
    const nonceStr = Math.random().toString(36).substr(2, 15);
    const timestamp = Math.floor(Date.now() / 1000);
    
    // 确保 URL 不包含 # 及其后面部分
    const cleanUrl = url.split('#')[0];
    
    // 生成签名字符串
    const string1 = `jsapi_ticket=${jsapiTicket}&noncestr=${nonceStr}&timestamp=${timestamp}&url=${cleanUrl}`;
    
    // 使用 crypto 生成 SHA1 签名
    const crypto = require('crypto');
    const signature = crypto.createHash('sha1').update(string1).digest('hex');

    // 返回配置
    return res.status(200).json({
      success: true,
      config: {
        appId: appId,
        timestamp: timestamp,
        nonceStr: nonceStr,
        signature: signature
      }
    });

  } catch (error) {
    console.error('微信 JS-SDK 签名生成错误:', error);
    return res.status(500).json({
      success: false,
      error: '签名生成失败: ' + error.message
    });
  }
}

// Cloudflare Workers 版本（如果需要）
// export default {
//   async fetch(request) {
//     const url = new URL(request.url);
//     const targetUrl = url.searchParams.get('url');
//     
//     if (!targetUrl) {
//       return new Response(JSON.stringify({ success: false, error: '缺少 url 参数' }), {
//         status: 400,
//         headers: { 'Content-Type': 'application/json' }
//       });
//     }
//     
//     // ... 类似的逻辑，但使用 Web Crypto API
//     // const encoder = new TextEncoder();
//     // const data = encoder.encode(string1);
//     // const hashBuffer = await crypto.subtle.digest('SHA-1', data);
//     // const hashArray = Array.from(new Uint8Array(hashBuffer));
//     // const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
//   }
// }

