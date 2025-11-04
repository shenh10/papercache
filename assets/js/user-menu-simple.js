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

  // 更新用户菜单UI（带防抖，避免频繁更新）
  let updateTimeout = null;
  function updateUserMenu(user) {
    const guestMenu = document.getElementById('user-menu-guest');
    const authMenu = document.getElementById('user-menu-authenticated');
    const userName = document.getElementById('user-name');
    const userEmail = document.getElementById('user-email');
    const userAvatarImg = document.getElementById('user-avatar-img');
    const userAvatarText = document.getElementById('user-avatar-text');

    if (!guestMenu || !authMenu) return;

    // 防抖：如果上次更新在100ms内，合并更新
    if (updateTimeout) {
      clearTimeout(updateTimeout);
    }
    
    updateTimeout = setTimeout(() => {
      const currentUser = window.SimpleAuth?.getCurrentUser();
      const finalUser = user !== undefined ? user : currentUser;
      
      console.log('UserMenu: 更新UI', finalUser?.email || '未登录');

      if (finalUser) {
        // 显示已登录菜单
        guestMenu.style.display = 'none';
        authMenu.style.display = 'block';

        // 更新用户信息
        if (userName) {
          userName.textContent = finalUser.profile?.username || finalUser.user_metadata?.username || finalUser.email?.split('@')[0] || '用户';
        }

        if (userEmail) {
          userEmail.textContent = finalUser.email || '';
        }

        // 更新头像
        const avatarUrl = finalUser.profile?.avatar_url || finalUser.user_metadata?.avatar_url;
        if (avatarUrl && userAvatarImg) {
          userAvatarImg.src = avatarUrl;
          userAvatarImg.style.display = 'block';
          if (userAvatarText) userAvatarText.style.display = 'none';
        } else if (userAvatarText) {
          // 显示用户名首字母
          const name = finalUser.profile?.username || finalUser.user_metadata?.username || finalUser.email?.split('@')[0] || 'U';
          userAvatarText.textContent = name.charAt(0).toUpperCase();
          userAvatarText.style.display = 'flex';
          if (userAvatarImg) userAvatarImg.style.display = 'none';
        }

        // 检查是否是管理员，显示/隐藏统计分析菜单项
        const adminLink = document.getElementById('user-menu-admin-link');
        if (adminLink && finalUser.id) {
          // 从数据库的 admins 表检查管理员权限
          const checkAdminStatus = async () => {
            try {
              // 检查是否有 Supabase 客户端
              if (window.supabase || (window.SimpleAuth && window.SimpleAuth.getSupabase)) {
                const supabase = window.supabase || window.SimpleAuth.getSupabase();
                if (supabase) {
                  const { data: isAdmin, error } = await supabase
                    .rpc('check_user_is_admin', {
                      p_user_id: finalUser.id
                    });

                  if (!error && isAdmin) {
                    adminLink.style.display = 'flex';
                    console.log('UserMenu: 管理员已登录，显示统计分析菜单');
                    return;
                  }
                }
              }
            } catch (e) {
              console.warn('UserMenu: 检查管理员权限失败，使用配置文件（向后兼容）', e);
            }

            // 降级：使用配置文件方式（向后兼容）
            try {
              let adminEmails = [];
              if (window.siteConfig && window.siteConfig.adminEmails) {
                adminEmails = window.siteConfig.adminEmails;
              } else {
                const adminMeta = document.querySelector('meta[name="admin-emails"]');
                if (adminMeta) {
                  adminEmails = JSON.parse(adminMeta.content);
                } else {
                  const adminEmailsScript = document.getElementById('admin-emails-config');
                  if (adminEmailsScript) {
                    adminEmails = JSON.parse(adminEmailsScript.textContent);
                  }
                }
              }
              const isAdmin = finalUser.email && adminEmails.includes(finalUser.email);
              adminLink.style.display = isAdmin ? 'flex' : 'none';
              if (isAdmin) {
                console.log('UserMenu: 管理员已登录，显示统计分析菜单（配置文件方式）');
              }
            } catch (e) {
              console.warn('UserMenu: 无法获取管理员信息', e);
              adminLink.style.display = 'none';
            }
          };

          checkAdminStatus();
        }

        // 只在需要时初始化下拉菜单（如果还没初始化）
        if (!document.getElementById('user-avatar')?._dropdownInitialized) {
          setTimeout(() => {
            initUserDropdown();
          }, 50);
        }
      } else {
        // 显示未登录菜单
        guestMenu.style.display = 'block';
        authMenu.style.display = 'none';
      }
      
      updateTimeout = null;
    }, 50); // 50ms防抖
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

  // 检查是否是移动端
  function isMobileDevice() {
    return window.innerWidth <= 768;
  }

  // 用户菜单下拉功能（带防重复初始化）
  function initUserDropdown() {
    const userAvatar = document.getElementById('user-avatar');
    const userDropdown = document.getElementById('user-dropdown');

    if (!userAvatar || !userDropdown) {
      return; // 元素不存在，可能未登录或页面没有用户菜单
    }

    // 检查是否已经初始化过（通过检查是否有事件监听器）
    if (userAvatar._dropdownHandler && userAvatar._dropdownInitialized) {
      // 已经初始化，只需要确保下拉状态正确
      // 移动端始终显示下拉菜单
      if (isMobileDevice()) {
        userDropdown.classList.add('open');
      }
      return;
    }

    // 移除旧的事件监听器（如果存在但不完整）
    if (userAvatar._dropdownHandler) {
      userAvatar.removeEventListener('click', userAvatar._dropdownHandler);
      userAvatar._dropdownHandler = null;
    }
    if (window._dropdownOutsideHandler) {
      document.removeEventListener('click', window._dropdownOutsideHandler);
      window._dropdownOutsideHandler = null;
    }

    let isOpen = false;
    const isMobile = isMobileDevice();

    // 移动端：下拉菜单始终可见
    if (isMobile) {
      userDropdown.classList.add('open');
      isOpen = true;
      // 移动端不需要点击头像来切换，菜单始终展开
      userAvatar.style.cursor = 'default';
      return;
    }

    // 桌面端：头像点击事件
    const clickHandler = function(e) {
      e.stopPropagation();
      isOpen = !isOpen;
      userDropdown.classList.toggle('open', isOpen);
    };

    userAvatar.addEventListener('click', clickHandler);
    userAvatar._dropdownHandler = clickHandler; // 保存引用以便后续移除

    // 点击外部关闭下拉菜单（仅桌面端）
    if (!isMobile) {
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
    }

    userAvatar._dropdownInitialized = true;
    
    // 监听窗口大小变化，更新移动端/桌面端状态
    let resizeTimer;
    const resizeHandler = function() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const currentlyMobile = isMobileDevice();
        if (currentlyMobile !== isMobile) {
          // 重新初始化以适应新的屏幕尺寸
          userAvatar._dropdownInitialized = false;
          if (userAvatar._dropdownHandler) {
            userAvatar.removeEventListener('click', userAvatar._dropdownHandler);
            userAvatar._dropdownHandler = null;
          }
          if (window._dropdownOutsideHandler) {
            document.removeEventListener('click', window._dropdownOutsideHandler);
            window._dropdownOutsideHandler = null;
          }
          // 延迟重新初始化，避免频繁触发
          setTimeout(() => {
            initUserDropdown();
          }, 100);
        }
      }, 200);
    };
    
    window.addEventListener('resize', resizeHandler);

    console.log('UserMenu: 下拉菜单已初始化', isMobile ? '(移动端模式)' : '(桌面端模式)');
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
    // 重新初始化主菜单逻辑（如果需要）
    if (!window.userMenuInitialized) {
      console.log('UserMenu: Turbolinks页面加载，重新初始化');
      initUserMenu();
    } else {
      // 如果已经初始化，只在需要时更新UI（避免频繁更新）
      // UI更新会由 SimpleAuth 的状态变化通知自动触发，这里不需要手动更新
    }

    // 只在元素存在且未初始化时才初始化下拉菜单
    const userAvatar = document.getElementById('user-avatar');
    if (userAvatar && !userAvatar._dropdownInitialized) {
      initUserDropdown();
    }
  });

  console.log('UserMenu: 🚀 用户菜单组件已加载');

})();