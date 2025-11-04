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

  // 登录日志去重：记录当前正在处理的登录事件，避免SIGNED_IN和INITIAL_SESSION重复记录
  // 使用Set存储正在处理的userId，处理完成后立即清除
  const loginLogProcessing = new Set(); // userId

  // Supabase客户端
  let supabase = null;

  /**
   * 初始化认证系统
   */
  async function init() {
    if (AuthState.isInitialized) {
      console.log('SimpleAuth: 已初始化，跳过重复初始化');
      return;
    }

    if (AuthState.isLoading) {
      console.log('SimpleAuth: 正在初始化中，等待完成...');
      return;
    }

    AuthState.isLoading = true;
    console.log('SimpleAuth: 开始初始化...');

    try {
      // 获取Supabase客户端
      supabase = window.getSupabaseClient?.();
      if (!supabase) {
        throw new Error('Supabase客户端不可用');
      }

      // 恢复已保存的状态（页面导航时）
      if (window._simpleAuthUser) {
        AuthState.user = window._simpleAuthUser;
        console.log('SimpleAuth: 从全局状态恢复用户', AuthState.user.email);
      } else {
        // 首次初始化，检查session
        await checkSession();
      }

      // 设置认证状态监听器
      setupAuthListener();

      AuthState.isInitialized = true;
      console.log('SimpleAuth: ✅ 初始化完成', AuthState.user?.email || '未登录');

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
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.warn('SimpleAuth: 获取session失败', error.message);
        return null;
      }

      if (session?.user) {
        console.log('SimpleAuth: 发现有效session', session.user.email);
        
        // 检查这是否是新登录（之前没有用户，现在有了）
        // 这种情况通常发生在OAuth重定向回来后，触发的是INITIAL_SESSION而不是SIGNED_IN
        const wasLoggedIn = AuthState.user !== null;
        const isNewLogin = !wasLoggedIn && session?.user;
        
        AuthState.user = session.user;
        window._simpleAuthUser = session.user;

        // 异步加载profile（不阻塞初始化）
        loadProfile(session.user.id);
        
        // 注意：不在checkSession中记录登录日志，因为：
        // 1. checkSession只是检查现有session，不是真正的登录事件
        // 2. 真正的登录事件应该由onAuthStateChange的SIGNED_IN或INITIAL_SESSION事件处理
        // 3. 这样可以避免重复记录（页面刷新时checkSession会被调用，但这不是新登录）
        
        return session.user;
      }

      console.log('SimpleAuth: 未发现有效session');
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
      console.log('SimpleAuth: 使用缓存的profile');
      AuthState.user.profile = cached.profile;
      notifyStateChange();
      return cached.profile;
    }

    try {
      console.log('SimpleAuth: 加载用户profile...');
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Profile不存在，创建默认的
          console.log('SimpleAuth: profile不存在，创建默认profile');
          const defaultProfile = createDefaultProfile(userId);
          AuthState.user.profile = defaultProfile;
        } else {
          console.warn('SimpleAuth: 查询profile失败', error.message);
          AuthState.user.profile = createDefaultProfile(userId);
        }
      } else {
        console.log('SimpleAuth: ✅ profile加载成功');
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

      // 处理 INITIAL_SESSION：这通常发生在OAuth重定向回来时
      // 如果之前没有用户，现在有了session，说明是新登录，需要记录日志
      if (event === 'INITIAL_SESSION') {
        const wasLoggedIn = AuthState.user !== null;
        if (!wasLoggedIn && session?.user) {
          console.log('SimpleAuth: INITIAL_SESSION - 检测到新登录（OAuth重定向），记录登录日志');
          AuthState.user = session.user;
          window._simpleAuthUser = session.user;
          loadProfile(session.user.id);
          // 记录登录日志（OAuth登录时可能只触发INITIAL_SESSION而不是SIGNED_IN）
          logUserLogin(session.user.id).catch(err => {
            console.warn('SimpleAuth: 记录登录日志失败', err);
          });
          notifyStateChange();
        }
        return; // 不触发额外通知，避免重复
      }

      console.log('SimpleAuth: 认证状态变化', event, session?.user?.email || '未登录');

      if (event === 'SIGNED_IN' && session?.user) {
        AuthState.user = session.user;
        window._simpleAuthUser = session.user;
        loadProfile(session.user.id);
        // 记录登录日志
        logUserLogin(session.user.id).catch(err => {
          console.warn('SimpleAuth: 记录登录日志失败', err);
        });
        notifyStateChange();
      } else if (event === 'SIGNED_OUT') {
        AuthState.user = null;
        window._simpleAuthUser = null;
        profileCache.clear();
        // 清除登录日志处理标记（用户登出后，下次登录应该重新记录）
        loginLogProcessing.clear();
        notifyStateChange();
      }
      // 其他事件（如 PASSWORD_RECOVERY）暂不处理
    });

    // 保存订阅以便清理
    AuthState._subscription = subscription;
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
   * 记录用户登录日志（带去重机制，避免SIGNED_IN和INITIAL_SESSION重复记录）
   */
  async function logUserLogin(userId) {
    if (!supabase || !userId) {
      return;
    }

    // 去重检查：如果这个用户正在处理登录日志，跳过
    // 这样可以避免SIGNED_IN和INITIAL_SESSION事件同时触发时重复记录
    if (loginLogProcessing.has(userId)) {
      console.log('SimpleAuth: 跳过重复的登录日志（正在处理中）', userId);
      return;
    }

    // 标记为正在处理
    loginLogProcessing.add(userId);

    try {
      // 获取IP地址（如果有第三方服务）
      // 注意：客户端无法直接获取真实IP，可以通过后端API获取
      // 这里先使用空值，或者通过fetch获取IP
      let ipAddress = null;
      try {
        // 尝试从公共API获取IP（可选）
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
        console.warn('SimpleAuth: 记录登录日志失败', error);
      } else {
        console.log('SimpleAuth: ✅ 登录日志已记录');
      }
    } catch (error) {
      console.warn('SimpleAuth: 记录登录日志异常', error);
    } finally {
      // 处理完成，清除标记（使用setTimeout确保异步操作完成）
      // 延迟一小段时间再清除，防止同一事件流的快速重复调用
      setTimeout(() => {
        loginLogProcessing.delete(userId);
      }, 1000); // 1秒后清除标记
    }
  }

  /**
   * 用户登录（邮箱/密码）
   */
  async function login(email, password) {
    if (!supabase) {
      throw new Error('认证系统未初始化');
    }

    console.log('SimpleAuth: 开始登录...');
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error('SimpleAuth: 登录失败', error.message);
      throw error;
    }

    console.log('SimpleAuth: ✅ 登录成功');
    return data;
  }

  /**
   * OAuth登录（GitHub等）
   */
  async function signInWithOAuth(provider) {
    if (!supabase) {
      throw new Error('认证系统未初始化');
    }

    console.log('SimpleAuth: 开始OAuth登录，提供商:', provider);

    try {
      // 构建重定向URL，包含baseurl
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
      
      // 添加hash和search参数（如果有）
      if (window.location.search) {
        redirectTo += window.location.search;
      }
      if (window.location.hash) {
        redirectTo += window.location.hash;
      }

      console.log('SimpleAuth: OAuth重定向URL:', redirectTo);

      // 先尝试OAuth登录（不登出），看看是否会返回重定向URL
      let { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider, // 'github' 或 'google'
        options: {
          redirectTo: redirectTo,
          // 确保会重定向到OAuth提供商页面（不自动重定向，返回URL让我们手动处理）
          skipBrowserRedirect: true,
          // 可选：指定需要请求的权限范围
          // scopes: 'read:user user:email' // GitHub scope示例
        }
      });

      console.log('SimpleAuth: OAuth登录响应:', { data, error, hasUrl: !!data?.url });

      if (error) {
        console.error('SimpleAuth: OAuth登录失败', error.message, error);
        throw error;
      }

      // 检查是否有重定向URL
      if (data?.url) {
        console.log('SimpleAuth: OAuth登录流程已启动，重定向到:', data.url);
        // 手动重定向到OAuth提供商页面
        window.location.href = data.url;
        return { success: true, data };
      }

      // 如果data存在但没有url，打印详细信息用于调试
      if (data) {
        console.warn('SimpleAuth: OAuth返回了data但没有url:', JSON.stringify(data, null, 2));
      } else {
        console.warn('SimpleAuth: OAuth返回的data为null或undefined');
      }

      // 如果没有URL，可能是Supabase认为已经登录了（已有相同provider的session）
      // 这时需要先登出，然后重新尝试OAuth登录
      console.warn('SimpleAuth: OAuth登录返回数据中没有URL，检查是否已有session');
      
      // 检查是否已有session
      const { data: { session } } = await supabase.auth.getSession();
      console.log('SimpleAuth: 当前session状态:', { 
        hasSession: !!session, 
        userId: session?.user?.id,
        email: session?.user?.email,
        provider: session?.user?.app_metadata?.provider
      });
      
      if (session?.user) {
        console.log('SimpleAuth: 检测到已有session，先登出以允许切换账号');
        try {
          await supabase.auth.signOut();
          // 清除本地状态
          AuthState.user = null;
          window._simpleAuthUser = null;
          console.log('SimpleAuth: 已登出，重新尝试OAuth登录');
          // 等待一小段时间，确保登出完成
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // 重新尝试OAuth登录
          ({ data, error } = await supabase.auth.signInWithOAuth({
            provider: provider,
            options: {
              redirectTo: redirectTo,
              skipBrowserRedirect: true,
            }
          }));

          console.log('SimpleAuth: 重新OAuth登录响应:', { data, error, hasUrl: !!data?.url });

          if (error) {
            console.error('SimpleAuth: 重新OAuth登录失败', error.message);
            throw error;
          }

          if (data?.url) {
            console.log('SimpleAuth: 重新OAuth登录成功，重定向到:', data.url);
            window.location.href = data.url;
            return { success: true, data };
          } else {
            throw new Error('OAuth登录流程异常，无法获取重定向URL');
          }
        } catch (logoutError) {
          console.error('SimpleAuth: 登出并重新登录失败', logoutError);
          throw new Error('无法完成OAuth登录，请先手动登出后重试');
        }
      } else {
        // 没有session但也没有URL，这是异常情况
        throw new Error('OAuth登录流程异常，无法获取重定向URL');
      }

    } catch (error) {
      console.error('SimpleAuth: OAuth登录异常', error);
      throw error;
    }
  }

  /**
   * 用户登出
   */
  async function logout() {
    if (!supabase) {
      throw new Error('认证系统未初始化');
    }

    console.log('SimpleAuth: 开始登出...');
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('SimpleAuth: 登出失败', error.message);
      throw error;
    }

    console.log('SimpleAuth: ✅ 登出成功');
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

    console.log('SimpleAuth: 更新用户profile...');
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

    console.log('SimpleAuth: ✅ profile更新成功');
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

    console.log('SimpleAuth: 开始更新密码...');
    
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

    console.log('SimpleAuth: ✅ 密码更新成功');
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

  // 自动初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Turbolinks页面导航时重新绑定事件
  document.addEventListener('turbolinks:load', () => {
    if (!AuthState.isInitialized) {
      init();
    } else {
      // 页面导航时，通知UI组件更新
      console.log('SimpleAuth: 页面导航，保持认证状态');
      notifyStateChange();
    }
  });

  console.log('SimpleAuth: 🚀 认证系统已加载');

})(window);