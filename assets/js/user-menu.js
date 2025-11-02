// 用户菜单UI更新
(function() {
  'use strict';

  function updateUserMenu(user) {
    const guestMenu = document.getElementById('user-menu-guest');
    const authMenu = document.getElementById('user-menu-authenticated');
    const userName = document.getElementById('user-name');
    const userEmail = document.getElementById('user-email');
    const userAvatarImg = document.getElementById('user-avatar-img');
    const userAvatarText = document.getElementById('user-avatar-text');
    
    if (!guestMenu || !authMenu) return;
    
    if (user) {
      // 显示已登录菜单
      guestMenu.style.display = 'none';
      authMenu.style.display = 'block';
      
      // 更新用户信息
      if (userName) {
        userName.textContent = user.profile?.username || user.user_metadata?.username || user.email?.split('@')[0] || '用户';
      }
      
      if (userEmail) {
        userEmail.textContent = user.email || '';
      }
      
      // 更新头像
      const avatarUrl = user.profile?.avatar_url || user.user_metadata?.avatar_url;
      if (avatarUrl && userAvatarImg) {
        userAvatarImg.src = avatarUrl;
        userAvatarImg.style.display = 'block';
        if (userAvatarText) userAvatarText.style.display = 'none';
      } else if (userAvatarText) {
        // 显示用户名首字母
        const name = user.profile?.username || user.user_metadata?.username || user.email?.split('@')[0] || 'U';
        userAvatarText.textContent = name.charAt(0).toUpperCase();
        userAvatarText.style.display = 'flex';
        if (userAvatarImg) userAvatarImg.style.display = 'none';
      }
    } else {
      // 显示未登录菜单
      guestMenu.style.display = 'block';
      authMenu.style.display = 'none';
    }
  }

  // 等待认证服务加载
  function initUserMenu() {
    if (window.authService) {
      console.log('用户菜单：注册认证状态监听器');
      
      // 注册认证状态变化监听器
      window.authService.onAuthStateChange((user, event) => {
        console.log('用户菜单：认证状态变化', event, user?.email || '未登录');
        updateUserMenu(user);
      });
      
      // 立即获取一次当前用户状态（如果服务已初始化）
      window.authService.getCurrentUser().then(user => {
        console.log('用户菜单：获取当前用户', user?.email || '未登录');
        updateUserMenu(user);
      }).catch(error => {
        console.error('获取用户状态失败:', error);
        updateUserMenu(null);
      });
    } else {
      // 如果认证服务未加载，等待一段时间后重试
      console.log('用户菜单：等待 authService 加载...');
      let retryCount = 0;
      const maxRetries = 20; // 最多等待2秒（20 * 100ms）
      
      const checkInterval = setInterval(() => {
        retryCount++;
        if (window.authService) {
          clearInterval(checkInterval);
          console.log('用户菜单：authService 已加载，重新初始化');
          initUserMenu();
        } else if (retryCount >= maxRetries) {
          clearInterval(checkInterval);
          console.warn('用户菜单：authService 加载超时，显示登录按钮');
          updateUserMenu(null);
        }
      }, 100);
    }
  }
  
  // 页面加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUserMenu);
  } else {
    initUserMenu();
  }
  
  // 也监听自定义事件作为备用
  document.addEventListener('authStateChanged', function(event) {
    console.log('用户菜单：收到 authStateChanged 事件', event.detail?.user?.email || '未登录');
    if (event.detail && event.detail.user !== undefined) {
      updateUserMenu(event.detail.user);
    }
  });

  // 处理退出登录
  window.handleLogout = async function() {
    if (window.authService) {
      const result = await window.authService.signOut();
      if (result.success) {
        updateUserMenu(null);
      }
    }
  };

  // 用户菜单下拉功能
  document.addEventListener('DOMContentLoaded', function() {
    const userAvatar = document.getElementById('user-avatar');
    const userDropdown = document.getElementById('user-dropdown');
    
    if (userAvatar && userDropdown) {
      let isOpen = false;
      
      userAvatar.addEventListener('click', function(e) {
        e.stopPropagation();
        isOpen = !isOpen;
        userDropdown.classList.toggle('open', isOpen);
      });
      
      // 点击外部关闭下拉菜单
      document.addEventListener('click', function(e) {
        if (isOpen && !userDropdown.contains(e.target) && !userAvatar.contains(e.target)) {
          isOpen = false;
          userDropdown.classList.remove('open');
        }
      });
    }
  });
})();

