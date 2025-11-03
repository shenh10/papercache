/**
 * 用户菜单UI组件 - 使用SimpleAuth系统
 *
 * 功能：
 * - 监听认证状态变化
 * - 更新用户菜单UI
 * - 处理用户下拉菜单
 */

(function() {
  'use strict';

  // 更新用户菜单UI
  function updateUserMenu(user) {
    const guestMenu = document.getElementById('user-menu-guest');
    const authMenu = document.getElementById('user-menu-authenticated');
    const userName = document.getElementById('user-name');
    const userEmail = document.getElementById('user-email');
    const userAvatarImg = document.getElementById('user-avatar-img');
    const userAvatarText = document.getElementById('user-avatar-text');

    if (!guestMenu || !authMenu) return;

    console.log('UserMenu: 更新UI', user?.email || '未登录');

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

      // 用户登录后，重新初始化下拉菜单（DOM已更新）
      setTimeout(() => {
        initUserDropdown();
      }, 50);
    } else {
      // 显示未登录菜单
      guestMenu.style.display = 'block';
      authMenu.style.display = 'none';
    }
  }

  // 初始化用户菜单
  function initUserMenu() {
    // 防止重复初始化
    if (window.userMenuInitialized) {
      console.log('UserMenu: 已初始化，跳过重复初始化');
      return;
    }

    console.log('UserMenu: 初始化');
    window.userMenuInitialized = true;

    // 等待SimpleAuth加载
    const waitForSimpleAuth = () => {
      if (window.SimpleAuth) {
        console.log('UserMenu: SimpleAuth已加载，设置监听器');

        // 立即更新UI（如果有当前用户）
        const currentUser = window.SimpleAuth.getCurrentUser();
        if (currentUser) {
          console.log('UserMenu: 立即更新UI', currentUser.email);
          updateUserMenu(currentUser);
        }

        // 监听认证状态变化
        window.SimpleAuth.onAuthChange((user) => {
          console.log('UserMenu: 认证状态变化', user?.email || '未登录');
          updateUserMenu(user);
        });

      } else {
        // SimpleAuth还没加载，继续等待
        setTimeout(waitForSimpleAuth, 100);
      }
    };

    waitForSimpleAuth();
  }

  // 用户菜单下拉功能
  function initUserDropdown() {
    const userAvatar = document.getElementById('user-avatar');
    const userDropdown = document.getElementById('user-dropdown');

    if (!userAvatar || !userDropdown) {
      return; // 元素不存在，可能未登录或页面没有用户菜单
    }

    // 移除旧的事件监听器（如果存在）
    if (userAvatar._dropdownHandler) {
      userAvatar.removeEventListener('click', userAvatar._dropdownHandler);
      userAvatar._dropdownHandler = null;
    }
    if (window._dropdownOutsideHandler) {
      document.removeEventListener('click', window._dropdownOutsideHandler);
      window._dropdownOutsideHandler = null;
    }

    let isOpen = false;

    // 头像点击事件
    const clickHandler = function(e) {
      e.stopPropagation();
      isOpen = !isOpen;
      userDropdown.classList.toggle('open', isOpen);
      console.log('UserMenu: 用户头像点击，下拉菜单状态:', isOpen ? '打开' : '关闭');
    };

    userAvatar.addEventListener('click', clickHandler);
    userAvatar._dropdownHandler = clickHandler; // 保存引用以便后续移除

    // 点击外部关闭下拉菜单
    const outsideClickHandler = function(e) {
      if (isOpen && userDropdown && userAvatar) {
        if (!userDropdown.contains(e.target) && !userAvatar.contains(e.target)) {
          isOpen = false;
          userDropdown.classList.remove('open');
        }
      }
    };

    document.addEventListener('click', outsideClickHandler);
    window._dropdownOutsideHandler = outsideClickHandler; // 保存引用以便后续移除

    console.log('UserMenu: 下拉菜单已初始化');
  }

  // 处理退出登录
  window.handleLogout = async function() {
    if (window.SimpleAuth) {
      try {
        await window.SimpleAuth.logout();
        updateUserMenu(null);
      } catch (error) {
        console.error('UserMenu: 登出失败', error);
      }
    }
  };

  // 页面加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUserMenu);
  } else {
    initUserMenu();
  }

  // 在DOM加载时初始化下拉菜单
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUserDropdown);
  } else {
    initUserDropdown();
  }

  // 在Turbolinks页面加载时也初始化（重要！）
  document.addEventListener('turbolinks:load', function() {
    console.log('UserMenu: Turbolinks页面加载，重新初始化');

    // 重新初始化主菜单逻辑
    if (!window.userMenuInitialized) {
      initUserMenu();
    } else {
      // 如果已经初始化，只是更新UI
      const currentUser = window.SimpleAuth?.getCurrentUser();
      if (currentUser !== undefined) {
        updateUserMenu(currentUser);
      }
    }

    // 重新初始化下拉菜单
    initUserDropdown();
  });

  console.log('UserMenu: 🚀 用户菜单组件已加载');

})();