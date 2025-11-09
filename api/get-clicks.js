// Vercel Serverless Function - 获取点击统计数据

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // GitHub Gist配置
    const GIST_ID = process.env.GITHUB_GIST_ID;
    
    if (!GIST_ID) {
      return res.status(500).json({ error: 'Server configuration missing' });
    }

    // 获取Gist内容（公开Gist不需要token）
    const gistResponse = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!gistResponse.ok) {
      // 如果Gist不存在，返回空数据
      if (gistResponse.status === 404) {
        return res.status(200).json({});
      }
      throw new Error(`GitHub API error: ${gistResponse.status}`);
    }

    const gistData = await gistResponse.json();
    const filename = 'post_clicks.json';
    const fileContent = gistData.files[filename]?.content || '{}';
    const clicks = JSON.parse(fileContent);

    return res.status(200).json(clicks);

  } catch (error) {
    console.error('Error fetching clicks:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}




