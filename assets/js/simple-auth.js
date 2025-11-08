/**
 * 简化的认证系统
 *
 * 设计原则：
 * 1. 单一数据源 - 所有状态都在这里管理
 * 2. 最小化API调用 - 避免重复请求
 * 3. 简单事件系统 - 清晰的状态变化通知
 * 4. 页面导航友好 - Turbolinks导航时复用状态
 */

(function(window) {
  'use strict';

  // 全局状态存储
  const AuthState = {
    user: null,
    isLoading: false,
    isInitialized: false,
    listeners: new Set()
  };

  // Profile缓存 (1分钟TTL)
  const profileCache = new Map();
  const PROFILE_CACHE_TTL = 60000;

  // 登录行为跟踪：记录真正的登录行为，而非所有认证事件
  // 只在用户主动登录时记录（GitHub OAuth或邮箱登录），避免页面刷新等产生误记录
  const loginBehaviorTracker = new Map(); // userId -> { last_login_time, login_method }

  // Supabase客户端
  let supabase = null;

  /**
   * 初始化认证系统
   */
  async function init() {
    if (AuthState.isInitialized) {
      return;
    }

    if (AuthState.isLoading) {
      return;
    }

    AuthState.isLoading = true;

    try {
      // 获取Supabase客户端
      supabase = window.getSupabaseClient?.();
      if (!supabase) {
        throw new Error('Supabase客户端不可用');
      }

      // 恢复已保存的状态（页面导航时）
      if (window._simpleAuthUser) {
        AuthState.user = window._simpleAuthUser;
      } else {
        // 首次初始化，检查session
        await checkSession();
      }

      // 设置认证状态监听器
      setupAuthListener();

      AuthState.isInitialized = true;

    } catch (error) {
      console.error('SimpleAuth: 初始化失败', error);
      AuthState.user = null;
    } finally {
      AuthState.isLoading = false;
      notifyStateChange();
    }
  }

  /**
   * 检查当前session
   */
  async function checkSession() {
    try {
      // 检查URL hash中是否有OAuth回调的token
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const hasAccessToken = hashParams.has('access_token');
      const hasType = hashParams.has('type');
      
      if (hasAccessToken) {
        // 检测到URL hash中有OAuth回调token
        console.log('OAuth回调检测到:', {
          hasAccessToken,
          hasType,
          type: hashParams.get('type')
        });
      }
      
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        return null;
      }

      if (session?.user) {
        // 发现有效session

        // 使用统一的用户状态更新函数
        // 注意：不通知状态变化，因为这只是初始化检查，不是真正的登录事件
        updateUserState(session.user, 'INIT_CHECK', false);

        // 注意：不在checkSession中记录登录日志，因为：
        // 1. checkSession只是检查现有session，不是真正的登录事件
        // 2. 真正的登录事件应该由onAuthStateChange的SIGNED_IN或INITIAL_SESSION事件处理
        // 3. 这样可以避免重复记录（页面刷新时checkSession会被调用，但这不是新登录）

        return session.user;
      }

      return null;
    } catch (error) {
      console.error('SimpleAuth: 检查session异常', error);
      return null;
    }
  }

  /**
   * 加载用户profile（带缓存）
   */
  async function loadProfile(userId) {
    if (!userId) return;

    // 检查缓存
    const cached = profileCache.get(userId);
    if (cached && Date.now() - cached.timestamp < PROFILE_CACHE_TTL) {
      AuthState.user.profile = cached.profile;
      notifyStateChange();
      return cached.profile;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Profile不存在，创建默认的
          const defaultProfile = createDefaultProfile(userId);
          AuthState.user.profile = defaultProfile;
        } else {
          AuthState.user.profile = createDefaultProfile(userId);
        }
      } else {
        AuthState.user.profile = data;
      }

      // 缓存结果
      profileCache.set(userId, {
        profile: AuthState.user.profile,
        timestamp: Date.now()
      });

      window._simpleAuthUser = AuthState.user;
      
      // 延迟通知，避免在初始化过程中频繁触发
      // 如果是首次初始化时加载profile，会在 init() 的 finally 中统一通知
      if (AuthState.isInitialized) {
        notifyStateChange();
      }
    } catch (error) {
      console.error('SimpleAuth: 加载profile异常', error);
      AuthState.user.profile = createDefaultProfile(userId);
      
      // 延迟通知
      if (AuthState.isInitialized) {
        notifyStateChange();
      }
    }
  }

  /**
   * 创建默认profile
   */
  function createDefaultProfile(userId) {
    const user = AuthState.user;
    return {
      id: userId,
      username: user?.user_metadata?.username || user?.email?.split('@')[0] || 'user',
      avatar_url: user?.user_metadata?.avatar_url || null,
      full_name: user?.user_metadata?.full_name || null,
      bio: null
    };
  }

  /**
   * 设置Supabase认证监听器
   */
  function setupAuthListener() {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {

      // 忽略 TOKEN_REFRESHED，避免重复通知
      // TOKEN_REFRESHED: token刷新不影响用户状态，不需要通知UI
      if (event === 'TOKEN_REFRESHED') {
        return; // 直接返回，不触发状态变化通知
      }

      // 登录事件处理（INITIAL_SESSION 或 SIGNED_IN）
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        if (session?.user) {
          // 对于INITIAL_SESSION，只有在新用户时才处理
          // 注意：使用更严格的检查，避免重复处理
          if (event === 'INITIAL_SESSION') {
            // 如果已经有用户且用户ID相同，说明是页面刷新等非登录行为，跳过
            if (AuthState.user && AuthState.user.id === session.user.id) {
              // 即使跳过处理，也要更新用户状态（但不记录登录日志）
              updateUserState(session.user, event);
              return;
            }
          }

          // 对于SIGNED_IN，如果刚刚处理过INITIAL_SESSION且用户相同，可能是重复触发
          if (event === 'SIGNED_IN' && AuthState.user && AuthState.user.id === session.user.id) {
            // 检查是否刚刚记录过登录日志（通过loginBehaviorTracker）
            const lastLogin = loginBehaviorTracker.get(session.user.id);
            if (lastLogin && (Date.now() - lastLogin.last_login_time) < 5000) {
              // 更新用户状态但不记录日志
              updateUserState(session.user, event);
              return;
            }
          }

          // 检测是否是真正的登录行为，只有主动登录才记录
          // 注意：需要传入session.user以便检测provider信息
          const loginMethod = detectLoginMethod(session.user);
          if (loginMethod && shouldLogUserLogin(session.user.id, loginMethod)) {
            // 立即清除标记，避免SIGNED_IN事件再次检测到（在记录日志之前就清除）
            if (loginMethod.endsWith('_oauth')) {
              localStorage.removeItem('simple_auth_oauth_login_attempt');
            } else if (loginMethod === 'email_password') {
              localStorage.removeItem('simple_auth_email_login_attempt');
            }
            
            // 记录登录日志
            logUserLogin(session.user.id, loginMethod).catch(err => {
            });
          } else if (!loginMethod) {
            // 未检测到登录行为，跳过记录
          }

          // 使用统一的用户状态更新函数
          updateUserState(session.user, event);

          // OAuth重定向回来后，清理URL hash中的认证信息
          if (event === 'INITIAL_SESSION' && window.location.hash.includes('access_token')) {
            const cleanUrl = window.location.pathname + window.location.search;
            window.history.replaceState(null, '', cleanUrl);
          }
        }
        return;
      }

      // 登出事件处理
      if (event === 'SIGNED_OUT') {
        updateUserState(null, 'SIGNED_OUT');
        profileCache.clear();
        loginBehaviorTracker.clear(); // 清理登录行为跟踪
        // 清理所有登录标记
        localStorage.removeItem('simple_auth_email_login_attempt');
        localStorage.removeItem('simple_auth_oauth_login_attempt');
        return;
      }

      // 其他事件（如 PASSWORD_RECOVERY）暂不处理
    });

    // 保存订阅以便清理
    AuthState._subscription = subscription;
  }

  /**
   * 统一的用户状态更新函数（消除重复代码）
   * @param {Object|null} user - 用户对象
   * @param {string} eventType - 事件类型，用于日志记录
   * @param {boolean} shouldNotify - 是否通知状态变化
   */
  function updateUserState(user, eventType = 'UNKNOWN', shouldNotify = true) {
    const previousUser = AuthState.user;

    // 更新状态
    AuthState.user = user;
    window._simpleAuthUser = user;

    // 用户状态更新

    // 如果有新用户，加载profile
    if (user && previousUser?.id !== user?.id) {
      loadProfile(user.id);
    }

    // 通知状态变化
    if (shouldNotify) {
      notifyStateChange();
    }
  }

  /**
   * 通知所有监听器状态变化
   */
  function notifyStateChange() {
    AuthState.listeners.forEach(callback => {
      try {
        callback(AuthState.user);
      } catch (error) {
        console.error('SimpleAuth: 监听器回调异常', error);
      }
    });
  }

  /**
   * 判断是否是真正的登录行为（基于用户主动操作）
   * @param {string} userId - 用户ID
   * @param {string} loginMethod - 登录方式 ('github_oauth' | 'email_password')
   * @returns {boolean} 是否应该记录登录
   */
  function shouldLogUserLogin(userId, loginMethod) {
    const now = Date.now();
    const lastLogin = loginBehaviorTracker.get(userId);

    // 检查是否是重复的登录行为（防止短时间内重复记录）
    // 注意：缩短时间窗口到10秒，因为INITIAL_SESSION和SIGNED_IN可能在几秒内都触发
    if (lastLogin) {
      const timeDiff = now - lastLogin.last_login_time;
      // 如果10秒内有相同用户的相同登录方式，可能是重复触发（INITIAL_SESSION + SIGNED_IN），跳过
      if (timeDiff < 10000 && lastLogin.login_method === loginMethod) {
        console.log('[SimpleAuth] 检测到重复登录事件，跳过:', {
          userId: userId.substring(0, 8) + '...',
          loginMethod,
          timeDiff: Math.round(timeDiff / 1000) + '秒',
          lastLoginTime: new Date(lastLogin.last_login_time).toISOString()
        });
        return false;
      }
    }

    // 记录登录行为（在记录日志之前就标记，避免重复）
    // 注意：必须在检查通过后立即更新，确保后续的SIGNED_IN事件能被正确过滤
    loginBehaviorTracker.set(userId, {
      last_login_time: now,
      login_method: loginMethod
    });
    
    console.log('[SimpleAuth] 准备记录登录日志:', {
      userId: userId.substring(0, 8) + '...',
      loginMethod,
      timestamp: new Date(now).toISOString()
    });
    
    return true;
  }

  /**
   * 检测当前登录方式（基于用户主动行为）
   * @param {Object} user - 用户对象（可选，用于检测provider信息）
   * @returns {string|null} 'github_oauth' | 'email_password' | null
   */
  function detectLoginMethod(user = null) {
    // GitHub OAuth登录检测：URL中有access_token且之前有OAuth登录标记
    const urlHash = window.location.hash;
    const urlParams = new URLSearchParams(urlHash.substring(1));
    const oauthAttempt = localStorage.getItem('simple_auth_oauth_login_attempt');

    // 检查URL hash中是否有OAuth回调的token
    if (urlHash.includes('access_token')) {
      // 检查是否是OAuth回调（通过URL参数中的type判断）
      const type = urlParams.get('type');
      if (type === 'recovery' || type === 'signup') {
        // 这是密码重置或注册，不是OAuth登录
      } else if (oauthAttempt) {
        // 有OAuth登录标记，确认是OAuth登录
        // 从标记中提取provider
        const provider = oauthAttempt.split('_')[0];
        // 注意：不要在这里清除标记，而是在成功记录登录日志后再清除
        // 这样可以避免在多次检测时丢失标记
        console.log('[SimpleAuth] OAuth登录检测到:', {
          hasAccessToken: true,
          hasOAuthAttempt: true,
          provider,
          oauthAttempt: oauthAttempt.substring(0, 20) + '...'
        });
        return `${provider}_oauth`;
      } else {
        // URL中有access_token但没有OAuth标记，可能是：
        // 1. OAuth重定向但标记已过期或被清除
        // 2. 页面刷新后，标记已清除但URL hash还在
        // 3. 通过其他方式（如直接访问URL）获得的token
        // 检查user对象中的provider信息来判断
        const userToCheck = user || AuthState.user;
        const provider = userToCheck?.app_metadata?.provider;
        if (provider && (provider === 'github' || provider === 'google')) {
          // 如果session中有provider信息，且URL中有access_token，很可能是OAuth登录
          return `${provider}_oauth`;
        }
      }
    }

    // 如果没有URL hash但有OAuth登录标记，检查session中的provider信息来确认
    // 这种情况发生在：OAuth重定向后，URL hash已被清除，但标记还在
    if (!urlHash.includes('access_token') && oauthAttempt) {
      const userToCheck = user || AuthState.user;
      const providerFromAttempt = oauthAttempt.split('_')[0];
      const providerFromSession = userToCheck?.app_metadata?.provider;
      
      // 如果session中的provider与标记中的provider匹配，确认是OAuth登录
      if (providerFromSession && (providerFromSession === 'github' || providerFromSession === 'google')) {
        // 优先使用session中的provider（更准确）
        const finalProvider = providerFromSession;
        return `${finalProvider}_oauth`;
      } else if (providerFromAttempt === 'github' || providerFromAttempt === 'google') {
        // 如果session中没有provider但标记中有，使用标记中的provider
        return `${providerFromAttempt}_oauth`;
      }
    }

    // 邮箱登录检测：localStorage中有邮箱登录标记
    const emailLoginAttempt = localStorage.getItem('simple_auth_email_login_attempt');
    if (emailLoginAttempt) {
      // 注意：不要在这里清除标记，而是在成功记录登录日志后再清除
      // 这样可以避免在多次检测时丢失标记（INITIAL_SESSION 和 SIGNED_IN 可能都触发）
      // 检测到邮箱登录
      return 'email_password';
    }

    // 如果没有找到任何登录行为标记，说明这不是主动登录
    return null;
  }

  /**
   * 记录用户登录日志（简洁版本，不包含去重逻辑）
   * @param {string} userId - 用户ID
   * @param {string|null} sessionAccessToken - Session访问令牌
   * @param {string} eventType - 事件类型
   */
  async function logUserLogin(userId, sessionAccessToken = null, eventType = 'UNKNOWN') {
    if (!supabase || !userId) {
      return;
    }

    try {
      // 获取IP地址（如果有第三方服务）
      let ipAddress = null;
      try {
        // 可以选择启用IP获取
        // const ipResponse = await fetch('https://api.ipify.org?format=json');
        // const ipData = await ipResponse.json();
        // ipAddress = ipData.ip;
      } catch (e) {
        // 忽略IP获取失败
      }

      // 获取User Agent
      const userAgent = navigator.userAgent || null;

      // 调用数据库函数记录登录日志
      const { data, error } = await supabase.rpc('log_user_login', {
        p_user_id: userId,
        p_ip_address: ipAddress,
        p_user_agent: userAgent
      });

      if (error) {
        // 记录失败，静默处理
      }
    } catch (error) {
    }
  }

  /**
   * 用户登录（邮箱/密码）
   */
  async function login(email, password) {
    if (!supabase) {
      throw new Error('认证系统未初始化');
    }


    // 标记这是邮箱登录行为，用于后续检测
    localStorage.setItem('simple_auth_email_login_attempt', Date.now().toString());

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error('SimpleAuth: 邮箱登录失败', error.message);
      throw error;
    }

    return data;
  }

  /**
   * OAuth登录（GitHub等）
   */
  async function signInWithOAuth(provider) {
    if (!supabase) {
      throw new Error('认证系统未初始化');
    }


    // 标记这是OAuth登录行为，用于后续检测
    localStorage.setItem('simple_auth_oauth_login_attempt', `${provider}_${Date.now()}`);

    try {
      // 构建重定向URL，包含baseurl
      // 注意：OAuth重定向回来后，Supabase会在URL hash中添加认证信息
      // 我们只需要重定向到当前页面（不带hash和search），Supabase会自动处理
      const baseurl = window.PC_BASEURL || '';
      const currentPath = window.location.pathname;
      
      // 如果当前路径不包含baseurl，需要添加
      let redirectTo = window.location.origin;
      if (baseurl && baseurl !== '/') {
        redirectTo += baseurl;
      }
      // 添加当前路径（去掉可能的baseurl前缀）
      let path = currentPath;
      if (baseurl && baseurl !== '/' && path.startsWith(baseurl)) {
        path = path.substring(baseurl.length);
      }
      redirectTo += path || '/';
      
      // 注意：不添加hash和search参数
      // 因为OAuth重定向回来后，Supabase会在URL hash中添加认证token
      // 如果我们在redirectTo中包含这些参数，可能会导致冲突
      

      // 使用Supabase自动重定向进行OAuth登录
      let { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider, // 'github' 或 'google'
        options: {
          redirectTo: redirectTo,
          // 可选：指定需要请求的权限范围
          scopes: provider === 'github' ? 'read:user user:email' : 'email profile'
        }
      });


      if (error) {
        console.error('SimpleAuth: OAuth登录失败', error.message, error);
        throw error;
      }

      // Supabase会自动处理重定向到OAuth提供商页面
      // 如果能执行到这里，说明没有自动重定向（可能是错误情况）

    } catch (error) {
      console.error('SimpleAuth: OAuth登录异常', error);
      throw error;
    }
  }

  /**
   * 用户登出（完全清除所有状态）
   */
  async function logout() {
    if (!supabase) {
      throw new Error('认证系统未初始化');
    }


    try {
      // 1. 调用Supabase登出
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error('SimpleAuth: Supabase登出失败', error.message);
        // 即使Supabase登出失败，也继续清理本地状态
      }

      // 2. 清除本地认证状态
      updateUserState(null, 'LOGOUT');

      // 3. 清除profile缓存
      profileCache.clear();

      // 4. 清除登录行为跟踪
      loginBehaviorTracker.clear();
      // 清理所有登录标记
      localStorage.removeItem('simple_auth_email_login_attempt');
      localStorage.removeItem('simple_auth_oauth_login_attempt');

      // 5. 清除localStorage中的认证数据（强制清除）
      try {
        localStorage.removeItem('supabase.auth.token');
      } catch (e) {
      }

      // 6. 强制刷新认证状态（确保没有残留）
      setTimeout(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          // 如果还有残留，再次尝试清除
          await supabase.auth.signOut();
          updateUserState(null, 'FORCE_LOGOUT');
        }
      }, 100);


    } catch (error) {
      console.error('SimpleAuth: 登出过程中发生错误', error);
      // 即使出错也要确保本地状态被清除
      updateUserState(null, 'ERROR_LOGOUT');
      profileCache.clear();
      loginBehaviorTracker.clear();
      localStorage.removeItem('simple_auth_email_login_attempt');
      localStorage.removeItem('simple_auth_oauth_login_attempt');
      throw error;
    }
  }

  /**
   * 获取当前用户
   */
  function getCurrentUser() {
    return AuthState.user;
  }

  /**
   * 检查是否已登录
   */
  function isLoggedIn() {
    return !!AuthState.user;
  }

  /**
   * 监听认证状态变化
   */
  function onAuthChange(callback) {
    AuthState.listeners.add(callback);

    // 返回取消订阅函数
    return () => {
      AuthState.listeners.delete(callback);
    };
  }

  /**
   * 更新用户profile
   */
  async function updateProfile(updates) {
    if (!AuthState.user?.id) {
      throw new Error('用户未登录');
    }

    const { data, error } = await supabase
      .from('profiles')
      .upsert({
        id: AuthState.user.id,
        ...updates,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('SimpleAuth: 更新profile失败', error.message);
      throw error;
    }

    AuthState.user.profile = data;
    window._simpleAuthUser = AuthState.user;

    // 更新缓存
    profileCache.set(AuthState.user.id, {
      profile: data,
      timestamp: Date.now()
    });

    notifyStateChange();
    return data;
  }

  /**
   * 更新密码（用于重置密码流程）
   */
  async function updatePassword(newPassword) {
    if (!supabase) {
      throw new Error('认证系统未初始化');
    }

    
    // 检查是否有有效的session（重置密码时应该有session）
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('SimpleAuth: 获取session失败', sessionError.message);
      throw new Error('无法验证身份，请重新请求密码重置');
    }
    
    if (!session) {
      throw new Error('会话已过期，请重新请求密码重置');
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) {
      console.error('SimpleAuth: 更新密码失败', error.message);
      throw error;
    }

    return { success: true };
  }

  /**
   * 清理资源
   */
  function cleanup() {
    if (AuthState._subscription) {
      AuthState._subscription.unsubscribe();
      AuthState._subscription = null;
    }
    AuthState.listeners.clear();
    profileCache.clear();
  }

  // 导出API
  window.SimpleAuth = {
    init,
    login,
    signInWithOAuth,
    logout,
    getCurrentUser,
    isLoggedIn,
    onAuthChange,
    updateProfile,
    updatePassword,
    cleanup
  };

  // 自动初始化（等待Supabase客户端就绪）
  function waitAndInit() {
    // 检查Supabase客户端是否可用
    if (window.getSupabaseClient && window.getSupabaseClient()) {
      init();
    } else if (window.supabaseLoadFailed) {
      // SDK加载失败，不再等待
      console.warn('SimpleAuth: Supabase SDK加载失败，认证系统将不可用');
    } else {
      // 继续等待（最多等待5秒）
      let waitCount = 0;
      const maxWait = 50;
      const checkInterval = setInterval(() => {
        waitCount++;
        if (window.getSupabaseClient && window.getSupabaseClient()) {
          clearInterval(checkInterval);
          init();
        } else if (window.supabaseLoadFailed || waitCount >= maxWait) {
          clearInterval(checkInterval);
          console.warn('SimpleAuth: Supabase客户端初始化超时，认证系统将不可用');
        }
      }, 100);
    }
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitAndInit);
  } else {
    // 延迟一点执行，确保其他脚本已加载
    setTimeout(waitAndInit, 100);
  }

  // Turbolinks页面导航时重新绑定事件
  document.addEventListener('turbolinks:load', () => {
    if (!AuthState.isInitialized) {
      waitAndInit();
    } else {
      // 页面导航时，通知UI组件更新
      notifyStateChange();
    }
  });


})(window);