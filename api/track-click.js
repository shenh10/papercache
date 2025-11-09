// Vercel Serverless Function - 记录文章点击
// 使用GitHub Gist存储统计数据

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { postUrl } = req.body;
  
  if (!postUrl) {
    return res.status(400).json({ error: 'postUrl is required' });
  }

  try {
    // GitHub Gist配置（需要在环境变量中设置）
    const GIST_ID = process.env.GITHUB_GIST_ID;
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    
    if (!GIST_ID || !GITHUB_TOKEN) {
      // 如果没有配置GitHub Gist，返回错误或使用备用方案
      return res.status(500).json({ error: 'Server configuration missing' });
    }

    // 获取当前Gist内容
    const gistResponse = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!gistResponse.ok) {
      throw new Error(`GitHub API error: ${gistResponse.status}`);
    }

    const gistData = await gistResponse.json();
    const filename = 'post_clicks.json';
    const fileContent = gistData.files[filename]?.content || '{}';
    const clicks = JSON.parse(fileContent);

    // 增加点击量
    clicks[postUrl] = (clicks[postUrl] || 0) + 1;

    // 更新Gist
    const updateResponse = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        files: {
          [filename]: {
            content: JSON.stringify(clicks, null, 2)
          }
        }
      })
    });

    if (!updateResponse.ok) {
      throw new Error(`Failed to update Gist: ${updateResponse.status}`);
    }

    return res.status(200).json({ 
      success: true, 
      clicks: clicks[postUrl],
      message: 'Click tracked successfully'
    });

  } catch (error) {
    console.error('Error tracking click:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}




