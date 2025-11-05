// 搜索功能调试脚本
console.log('🔍 搜索调试脚本已加载');

// 检查API端点是否可访问
async function testAPIs() {
  const apis = [
    '/api/search',
    '/api/suggestions', 
    '/api/stats'
  ];
  
  for (const api of apis) {
    try {
      const response = await fetch(api);
      console.log(`✅ ${api}: ${response.status} ${response.statusText}`);
      if (response.ok) {
        const data = await response.json();
        console.log(`📊 ${api} 数据:`, data);
      }
    } catch (error) {
      console.error(`❌ ${api}:`, error);
    }
  }
}

// 检查搜索组件是否正确初始化
function checkSearchComponents() {
  console.log('🔍 检查搜索组件...');
  
  const searchWidget = document.getElementById('search-widget');
  const searchInput = document.getElementById('search-widget-input');
  const searchBtn = document.getElementById('search-widget-btn');
  
  console.log('搜索组件存在:', !!searchWidget);
  console.log('搜索输入框存在:', !!searchInput);
  console.log('搜索按钮存在:', !!searchBtn);
  
  if (searchWidget) {
    console.log('搜索组件HTML:', searchWidget.outerHTML.substring(0, 200) + '...');
  }
}

// 检查事件绑定
function checkEventBindings() {
  console.log('🔍 检查事件绑定...');
  
  const searchInput = document.getElementById('search-widget-input');
  const searchBtn = document.getElementById('search-widget-btn');
  
  if (searchInput) {
    console.log('搜索输入框事件监听器数量:', searchInput._listeners?.length || '未知');
  }
  
  if (searchBtn) {
    console.log('搜索按钮事件监听器数量:', searchBtn._listeners?.length || '未知');
  }
}

// 手动测试搜索
async function manualSearchTest(query = 'transformer') {
  console.log(`🔍 手动测试搜索: "${query}"`);
  
  try {
    const response = await fetch('/api/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: query,
        filters: {},
        limit: 5
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ 搜索成功:', data);
      return data;
    } else {
      console.error('❌ 搜索失败:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('❌ 搜索错误:', error);
  }
}

// 页面加载完成后运行调试
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 开始搜索功能调试...');
  
  setTimeout(() => {
    checkSearchComponents();
    checkEventBindings();
    testAPIs();
    
    // 等待2秒后测试搜索
    setTimeout(() => {
      manualSearchTest();
    }, 2000);
  }, 1000);
});

// 暴露到全局供手动调用
window.searchDebug = {
  testAPIs,
  checkSearchComponents,
  checkEventBindings,
  manualSearchTest
};



