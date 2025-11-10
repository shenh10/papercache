// Supabase Edge Function: 微信 JS-SDK 签名生成
// 部署命令: supabase functions deploy wechat-jssdk-sign

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 获取请求参数
    const { url } = await req.json()
    
    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: '缺少 url 参数' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // 从环境变量获取微信配置
    const appId = Deno.env.get('WECHAT_APP_ID')
    const appSecret = Deno.env.get('WECHAT_APP_SECRET')

    if (!appId || !appSecret) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: '微信配置未设置，请检查环境变量 WECHAT_APP_ID 和 WECHAT_APP_SECRET' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // 1. 获取 access_token
    const tokenUrl = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`
    const tokenRes = await fetch(tokenUrl)
    const tokenData = await tokenRes.json()

    if (tokenData.errcode) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `获取 access_token 失败: ${tokenData.errmsg || '未知错误'}`,
          errcode: tokenData.errcode
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const accessToken = tokenData.access_token

    // 2. 获取 jsapi_ticket
    const ticketUrl = `https://api.weixin.qq.com/cgi-bin/ticket/getticket?type=jsapi&access_token=${accessToken}`
    const ticketRes = await fetch(ticketUrl)
    const ticketData = await ticketRes.json()

    if (ticketData.errcode !== 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `获取 jsapi_ticket 失败: ${ticketData.errmsg || '未知错误'}`,
          errcode: ticketData.errcode
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const jsapiTicket = ticketData.ticket

    // 3. 生成签名
    const nonceStr = Math.random().toString(36).substr(2, 15)
    const timestamp = Math.floor(Date.now() / 1000)
    
    // 确保 URL 不包含 # 及其后面部分
    const cleanUrl = url.split('#')[0]
    
    // 生成签名字符串
    const string1 = `jsapi_ticket=${jsapiTicket}&noncestr=${nonceStr}&timestamp=${timestamp}&url=${cleanUrl}`
    
    // 使用 Web Crypto API 生成 SHA1 签名（Deno 环境）
    const encoder = new TextEncoder()
    const data = encoder.encode(string1)
    const hashBuffer = await crypto.subtle.digest('SHA-1', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

    // 返回配置
    return new Response(
      JSON.stringify({
        success: true,
        config: {
          appId: appId,
          timestamp: timestamp,
          nonceStr: nonceStr,
          signature: signature
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('微信 JS-SDK 签名生成错误:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: '签名生成失败: ' + error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

