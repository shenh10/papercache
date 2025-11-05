// ============================================
// 修复后的收藏统计函数
// 替换原有的 loadFavoritesStats 函数
// ============================================

// 加载收藏统计（修复版本）
async function loadFavoritesStats() {
  const statEl = document.getElementById('stat-total-favorites');
  if (!statEl) return;

  const supabase = getSupabase();
  if (!supabase) {
    statEl.textContent = '未初始化';
    return;
  }

  try {
    console.log('[Admin] 开始加载收藏统计...');

    // 尝试多个方法获取收藏统计
    let totalCount = 0;
    let method = '';

    // 方法1：使用新的管理员专用函数
    try {
      const { data, error } = await supabase.rpc('get_total_favorites_count_admin');
      if (!error && data !== null) {
        totalCount = data;
        method = 'admin_function';
        console.log('[Admin] 方法1成功：使用管理员函数，总收藏数:', totalCount);
      } else {
        throw new Error(error?.message || '函数返回null');
      }
    } catch (err1) {
      console.warn('[Admin] 方法1失败:', err1.message);

      // 方法2：使用统计视图
      try {
        const { data, error } = await supabase
          .from('favorites_stats_view')
          .select('total_favorites')
          .single();

        if (!error && data) {
          totalCount = data.total_favorites;
          method = 'stats_view';
          console.log('[Admin] 方法2成功：使用统计视图，总收藏数:', totalCount);
        } else {
          throw new Error(error?.message || '视图查询失败');
        }
      } catch (err2) {
        console.warn('[Admin] 方法2失败:', err2.message);

        // 方法3：使用详细分析函数
        try {
          const { data, error } = await supabase.rpc('get_favorites_analytics');
          if (!error && data && data.length > 0) {
            totalCount = data[0].total_favorites;
            method = 'analytics_function';
            console.log('[Admin] 方法3成功：使用分析函数，总收藏数:', totalCount);
          } else {
            throw new Error(error?.message || '分析函数返回空');
          }
        } catch (err3) {
          console.warn('[Admin] 方法3失败:', err3.message);

          // 方法4：尝试使用原有函数
          try {
            const { data, error } = await supabase.rpc('get_total_favorites_count');
            if (!error && data !== null) {
              totalCount = data;
              method = 'original_function';
              console.log('[Admin] 方法4成功：使用原函数，总收藏数:', totalCount);
            } else {
              throw new Error(error?.message || '原函数返回null');
            }
          } catch (err4) {
            console.warn('[Admin] 所有方法都失败:', err4.message);

            // 最后的诊断信息
            console.error('[Admin] 收藏统计完全失败');
            console.error('[Admin] 可能原因:');
            console.error('1. 函数未正确部署到 Supabase');
            console.error('2. RLS 策略限制过于严格');
            console.error('3. 数据库连接问题');
            console.error('4. 用户权限不足');

            statEl.innerHTML = '<span style="color: red;">权限问题</span>';
            statEl.title = '所有统计方法都失败，请检查 Supabase 函数部署和权限设置';
            return;
          }
        }
      }
    }

    // 成功获取数据
    statEl.textContent = totalCount.toLocaleString();
    statEl.style.color = totalCount > 0 ? '#2d3748' : '#718096';
    statEl.title = `使用方法: ${method} | 总收藏数: ${totalCount}`;

    console.log('[Admin] ✅ 收藏统计加载成功:', {
      count: totalCount,
      method: method
    });

  } catch (error) {
    console.error('[Admin] 加载收藏统计失败:', error);
    statEl.textContent = '错误';
    statEl.style.color = '#e53e3e';
    statEl.title = `错误: ${error.message}`;
  }
}

// 增强版收藏统计详情（可选）
async function loadFavoritesDetailedStats() {
  const container = document.getElementById('favorites-detailed-stats');
  if (!container) return;

  const supabase = getSupabase();
  if (!supabase) {
    container.innerHTML = '<div class="stats-message">未初始化</div>';
    return;
  }

  try {
    console.log('[Admin] 加载详细收藏统计...');

    const { data, error } = await supabase.rpc('get_favorites_analytics');

    if (error) {
      console.error('[Admin] 获取详细收藏统计失败:', error);
      container.innerHTML = '<div class="stats-message">加载失败</div>';
      return;
    }

    if (!data || data.length === 0) {
      container.innerHTML = '<div class="stats-message">暂无数据</div>';
      return;
    }

    const stats = data[0];

    let html = `
      <div class="detailed-stats-grid">
        <div class="stat-item">
          <div class="stat-label">总收藏数</div>
          <div class="stat-value">${stats.total_favorites.toLocaleString()}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">收藏用户数</div>
          <div class="stat-value">${stats.unique_users.toLocaleString()}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">人均收藏</div>
          <div class="stat-value">${stats.favorites_per_user}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">数据更新时间</div>
          <div class="stat-value">${new Date().toLocaleString('zh-CN')}</div>
        </div>
      </div>
    `;

    if (stats.most_active_users && stats.most_active_users.length > 0) {
      html += `
        <div class="most-active-users">
          <h4>最活跃收藏用户</h4>
          <div class="users-list">
      `;

      stats.most_active_users.forEach(user => {
        html += `
          <div class="user-item">
            <span class="user-id">${user.user_id.substring(0, 8)}...</span>
            <span class="favorite-count">${user.favorite_count} 收藏</span>
          </div>
        `;
      });

      html += `
          </div>
        </div>
      `;
    }

    container.innerHTML = html;
    console.log('[Admin] ✅ 详细收藏统计加载成功');

  } catch (error) {
    console.error('[Admin] 加载详细收藏统计异常:', error);
    container.innerHTML = '<div class="stats-message">加载失败</div>';
  }
}

// 在页面加载时自动应用修复
document.addEventListener('DOMContentLoaded', function() {
  // 替换原有的收藏统计函数
  if (typeof window.loadFavoritesStats === 'function') {
    const originalLoadFavoritesStats = window.loadFavoritesStats;
    window.loadFavoritesStats = loadFavoritesStats;
    console.log('[Admin] ✅ 收藏统计函数已替换为修复版本');
  }

  // 如果页面在统计分析标签页，立即加载
  if (window.location.hash === '#analytics' || document.querySelector('#tab-analytics.active')) {
    setTimeout(() => {
      loadFavoritesStats();
    }, 1000);
  }
});

// 导出函数供外部使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    loadFavoritesStats,
    loadFavoritesDetailedStats
  };
}

// CSS 样式（如果需要）
const styles = `
<style>
.detailed-stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.stat-item {
  background: #f7fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 1rem;
  text-align: center;
}

.stat-label {
  font-size: 0.875rem;
  color: #718096;
  margin-bottom: 0.5rem;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: bold;
  color: #2d3748;
}

.most-active-users {
  margin-top: 2rem;
}

.most-active-users h4 {
  margin-bottom: 1rem;
  color: #2d3748;
}

.users-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.user-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  background: #f7fafc;
  border-radius: 4px;
}

.user-id {
  font-family: monospace;
  color: #4a5568;
}

.favorite-count {
  font-weight: bold;
  color: #3182ce;
}

.stats-message {
  text-align: center;
  color: #718096;
  padding: 1rem;
  background: #f7fafc;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
}
</style>
`;

// 动态添加样式
if (document.head) {
  const styleElement = document.createElement('style');
  styleElement.textContent = styles;
  document.head.appendChild(styleElement);
}