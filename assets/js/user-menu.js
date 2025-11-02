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

  // 监听认证状态变化
  if (window.authService) {
    window.authService.onAuthStateChange((user) => {
      updateUserMenu(user);
    });
    
    // 初始化时更新一次
    window.authService.getCurrentUser().then(user => {
      updateUserMenu(user);
    });
  } else {
    // 如果认证服务未加载，直接显示登录按钮（未登录状态）
    console.warn('authService 未加载，显示登录按钮');
    updateUserMenu(null);
  }

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

