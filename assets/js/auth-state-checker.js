// 统一的认证状态检查模块
// 所有页面都应该使用这个模块来检查登录状态，避免重复逻辑
(function() {
  'use strict';

  /**
   * 快速检查全局登录状态（最快的方式）
   * 在auth.js初始化之前就可以使用，避免页面闪烁
   * 
   * @returns {Object|null} 用户对象或null
   */
  function getQuickAuthState() {
    if (window._authCurrentUser) {
      console.log('auth-state-checker: ✅ 检测到全局登录状态', window._authCurrentUser.email);
      return window._authCurrentUser;
    }
    
    // 如果全局状态不存在，但Supabase客户端已初始化，尝试快速从session恢复
    const supabase = window.getSupabaseClient && window.getSupabaseClient();
    if (supabase && !window._authStateRestoreAttempted) {
      window._authStateRestoreAttempted = true; // 防止重复尝试
      // 异步尝试恢复，不阻塞
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          console.log('auth-state-checker: ✅ 从session快速恢复全局状态', session.user.email);
          window._authCurrentUser = {
            ...session.user,
            profile: null
          };
          // 触发UI更新
          if (window.authStateChecker && window.authStateChecker.updateUIImmediately) {
            // 稍后更新UI
            setTimeout(() => {
              // UI组件可能已注册监听器，通过事件通知
              document.dispatchEvent(new CustomEvent('authStateChanged', {
                detail: { user: window._authCurrentUser, event: 'SIGNED_IN' }
              }));
            }, 10);
          }
        }
      }).catch(err => {
        console.warn('auth-state-checker: 快速恢复session失败', err);
      });
    }
    
    return null;
  }

  /**
   * 从session快速获取登录状态（从localStorage读取，很快）
   * 
   * @returns {Promise<Object|null>} 用户对象或null
   */
  async function getAuthStateFromSession() {
    const supabase = window.getSupabaseClient();
    if (!supabase) {
      return null;
    }

    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.warn('auth-state-checker: getSession错误', error);
        return null;
      }
      
      if (session?.user) {
        console.log('auth-state-checker: ✅ 从session获取用户状态', session.user.email);
        return {
          ...session.user,
          profile: null // profile稍后加载
        };
      }
    } catch (e) {
      console.warn('auth-state-checker: getSession异常', e);
    }
    
    return null;
  }

  /**
   * 从authService获取完整用户信息（包括profile，可能较慢）
   * 
   * @param {number} timeoutMs 超时时间（毫秒），默认5000
   * @returns {Promise<Object|null>} 用户对象或null
   */
  async function getAuthStateFromService(timeoutMs = 5000) {
    if (!window.authService) {
      return null;
    }

    try {
      const userPromise = window.authService.getCurrentUser();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('获取用户状态超时')), timeoutMs)
      );
      
      const user = await Promise.race([userPromise, timeoutPromise]);
      if (user) {
        console.log('auth-state-checker: ✅ 从authService获取用户状态', user.email);
      }
      return user;
    } catch (e) {
      console.warn('auth-state-checker: 从authService获取用户状态失败', e.message || e);
      return null;
    }
  }

  /**
   * 统一的认证状态检查函数
   * 按优先级检查：全局状态 -> session -> authService
   * 
   * @param {Object} options 选项
   * @param {boolean} options.waitForService 是否等待authService初始化（默认true）
   * @param {number} options.serviceTimeout 等待authService的超时时间（毫秒，默认3000）
   * @param {number} options.getUserTimeout authService.getCurrentUser的超时时间（毫秒，默认5000）
   * @returns {Promise<Object|null>} 用户对象或null
   */
  async function checkAuthState(options = {}) {
    const {
      waitForService = true,
      serviceTimeout = 3000,
      getUserTimeout = 5000
    } = options;

    // 优先级1：全局状态（最快，几乎瞬间）
    const globalUser = getQuickAuthState();
    if (globalUser) {
      return globalUser;
    }

    // 优先级2：从session获取（从localStorage读取，很快）
    const sessionUser = await getAuthStateFromSession();
    if (sessionUser) {
      // 同步到全局状态
      window._authCurrentUser = sessionUser;
      return sessionUser;
    }

    // 优先级3：从authService获取（可能需要等待初始化）
    if (waitForService) {
      // 等待authService初始化
      if (!window.authService) {
        console.log('auth-state-checker: 等待authService初始化...');
        const startTime = Date.now();
        while (!window.authService && (Date.now() - startTime) < serviceTimeout) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      if (window.authService) {
        return await getAuthStateFromService(getUserTimeout);
      }
    }

    return null;
  }

  /**
   * 立即更新UI（不等待认证服务）
   * 如果检测到全局状态，立即调用回调函数更新UI
   * 
   * @param {Function} updateCallback 更新UI的回调函数 (user) => void
   * @param {Function} errorCallback 错误回调函数 () => void（可选）
   */
  function updateUIImmediately(updateCallback, errorCallback) {
    if (typeof updateCallback !== 'function') {
      console.error('auth-state-checker: updateCallback必须是函数');
      return;
    }

    let user = getQuickAuthState();
    
    // 如果全局状态不存在，但Supabase已初始化，尝试快速从session恢复
    if (!user) {
      const supabase = window.getSupabaseClient && window.getSupabaseClient();
      if (supabase) {
        // 同步快速检查（如果可能）
        try {
          // 尝试直接从localStorage读取（同步，很快）
          const sessionKey = 'supabase.auth.token';
          const sessionData = localStorage.getItem(sessionKey);
          if (sessionData) {
            try {
              const parsed = JSON.parse(sessionData);
              // Supabase存储格式可能是多种，尝试常见格式
              const session = parsed?.currentSession || parsed?.session || parsed;
              if (session?.user || session?.access_token) {
                console.log('auth-state-checker: ✅ 从localStorage检测到session，立即恢复');
                // 如果只有access_token，需要异步获取用户信息
                if (session.user) {
                  user = {
                    ...session.user,
                    profile: null
                  };
                  window._authCurrentUser = user;
                  console.log('auth-state-checker: ✅ 立即设置全局状态（从localStorage）');
                } else if (session.access_token) {
                  // 有token但没用户信息，异步获取（但先更新UI显示加载状态）
                  console.log('auth-state-checker: 检测到token，异步获取用户信息...');
                  supabase.auth.getSession().then(({ data: { session: fullSession } }) => {
                    if (fullSession?.user) {
                      const fullUser = {
                        ...fullSession.user,
                        profile: null
                      };
                      window._authCurrentUser = fullUser;
                      updateCallback(fullUser);
                    }
                  }).catch(err => {
                    console.warn('auth-state-checker: 异步获取session失败', err);
                  });
                  // 返回true表示正在处理，稍后会更新
                  return true;
                }
              }
            } catch (parseErr) {
              // 解析失败，继续尝试其他方式
            }
          }
        } catch (storageErr) {
          // localStorage读取失败，继续
        }
      }
    }
    
    if (user) {
      console.log('auth-state-checker: ✅ 立即更新UI（使用全局状态）', user.email);
      // 根据DOM加载状态决定立即更新还是等待
      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        updateCallback(user);
      } else if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          updateCallback(user);
        }, { once: true });
      } else {
        updateCallback(user);
      }
      return true;
    }
    
    return false;
  }

  /**
   * 注册认证状态监听器
   * 当认证状态变化时自动调用回调
   * 
   * @param {Function} callback 状态变化回调 (user, event) => void
   */
  function onAuthStateChange(callback) {
    if (!window.authService) {
      // 如果authService还没加载，等待它
      let retryCount = 0;
      const maxRetries = 30; // 最多等待3秒
      
      const checkInterval = setInterval(() => {
        retryCount++;
        if (window.authService) {
          clearInterval(checkInterval);
          window.authService.onAuthStateChange(callback);
        } else if (retryCount >= maxRetries) {
          clearInterval(checkInterval);
          console.warn('auth-state-checker: authService加载超时，无法注册监听器');
        }
      }, 100);
    } else {
      window.authService.onAuthStateChange(callback);
    }
  }

  // 导出API
  window.authStateChecker = {
    // 快速获取（不等待）
    getQuick: getQuickAuthState,
    
    // 从session获取
    getFromSession: getAuthStateFromSession,
    
    // 从authService获取
    getFromService: getAuthStateFromService,
    
    // 统一检查（按优先级）
    check: checkAuthState,
    
    // 立即更新UI
    updateUIImmediately: updateUIImmediately,
    
    // 注册状态监听器
    onAuthStateChange: onAuthStateChange
  };

  console.log('auth-state-checker: ✅ 模块已加载');
})();

