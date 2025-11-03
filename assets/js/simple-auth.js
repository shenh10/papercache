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
        AuthState.user = session.user;
        window._simpleAuthUser = session.user;

        // 异步加载profile（不阻塞初始化）
        loadProfile(session.user.id);
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
      notifyStateChange();

    } catch (error) {
      console.error('SimpleAuth: 加载profile异常', error);
      AuthState.user.profile = createDefaultProfile(userId);
      notifyStateChange();
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
      console.log('SimpleAuth: 认证状态变化', event, session?.user?.email || '未登录');

      if (event === 'SIGNED_IN' && session?.user) {
        AuthState.user = session.user;
        window._simpleAuthUser = session.user;
        loadProfile(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        AuthState.user = null;
        window._simpleAuthUser = null;
        profileCache.clear();
      }
      // INITIAL_SESSION 和 TOKEN_REFRESHED 忽略，因为我们已经有更好的状态管理

      notifyStateChange();
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
   * 用户登录
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