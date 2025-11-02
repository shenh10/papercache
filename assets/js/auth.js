// 用户认证服务模块
(function() {
  'use strict';

  const supabase = window.getSupabaseClient?.();
  
  if (!supabase) {
    console.warn('Supabase客户端未初始化，认证功能不可用');
    return;
  }

  // ============================================
  // 认证状态管理
  // ============================================
  
  let currentUser = null;
  let authStateListeners = [];

  // 获取当前用户
  async function getCurrentUser() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      
      // 如果用户存在，获取用户档案
      if (user) {
        const profile = await getUserProfile(user.id);
        currentUser = {
          ...user,
          profile: profile
        };
      } else {
        currentUser = null;
      }
      
      return currentUser;
    } catch (error) {
      console.error('获取当前用户失败:', error);
      currentUser = null;
      return null;
    }
  }

  // 获取用户档案
  async function getUserProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('获取用户档案失败:', error);
      return null;
    }
  }

  // 监听认证状态变化
  supabase.auth.onAuthStateChange(async (event, session) => {
    console.log('Auth state changed:', event, session?.user?.email);
    
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      currentUser = await getCurrentUser();
      // 记录登录日志
      if (session?.user) {
        await logUserLogin(session.user.id);
      }
    } else if (event === 'SIGNED_OUT') {
      currentUser = null;
    }
    
    // 通知所有监听器
    authStateListeners.forEach(listener => {
      try {
        listener(currentUser, event);
      } catch (e) {
        console.error('Auth state listener error:', e);
      }
    });
    
    // 更新UI
    updateAuthUI();
  });

  // 注册认证状态监听器
  function onAuthStateChange(callback) {
    authStateListeners.push(callback);
    // 立即调用一次
    if (currentUser !== undefined) {
      callback(currentUser, currentUser ? 'SIGNED_IN' : 'SIGNED_OUT');
    }
  }

  // ============================================
  // 登录功能
  // ============================================

  // OAuth登录
  async function signInWithOAuth(provider) {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider, // 'github' 或 'google'
        options: {
          redirectTo: window.location.origin + window.location.pathname
        }
      });
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('OAuth登录失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 邮箱/密码登录
  async function signInWithEmail(email, password) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) throw error;
      
      // 记录登录日志
      if (data.user) {
        await logUserLogin(data.user.id);
      }
      
      return { success: true, user: data.user };
    } catch (error) {
      console.error('邮箱登录失败:', error);
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // 注册功能
  // ============================================

  // 邮箱注册
  async function signUpWithEmail(email, password, username) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username || email.split('@')[0]
          }
        }
      });
      
      if (error) throw error;
      return { success: true, user: data.user };
    } catch (error) {
      console.error('注册失败:', error);
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // 退出登录
  // ============================================

  async function signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      currentUser = null;
      updateAuthUI();
      return { success: true };
    } catch (error) {
      console.error('退出登录失败:', error);
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // 登录日志
  // ============================================

  async function logUserLogin(userId) {
    try {
      // 获取IP地址（通过调用Supabase Edge Function或直接在客户端记录）
      // 注意：IP地址在客户端获取可能不准确，最好在服务器端记录
      const ipAddress = null; // 无法在客户端获取真实IP
      const userAgent = navigator.userAgent;
      
      // 调用数据库函数记录登录日志
      const { error } = await supabase.rpc('log_user_login', {
        p_user_id: userId,
        p_ip_address: null,
        p_user_agent: userAgent
      });
      
      if (error) {
        // 如果函数不存在，直接插入（需要确保RLS允许）
        console.warn('登录日志函数调用失败，尝试直接插入:', error);
        const { error: insertError } = await supabase
          .from('login_logs')
          .insert({
            user_id: userId,
            user_agent: userAgent
          });
        
        if (insertError) {
          console.error('记录登录日志失败:', insertError);
        }
      }
    } catch (error) {
      console.error('记录登录日志时出错:', error);
    }
  }

  // ============================================
  // UI更新
  // ============================================

  function updateAuthUI() {
    // 触发自定义事件，让UI组件更新
    const event = new CustomEvent('authStateChanged', {
      detail: { user: currentUser }
    });
    document.dispatchEvent(event);
  }

  // ============================================
  // 初始化
  // ============================================

  // 页面加载时获取当前用户
  async function init() {
    currentUser = await getCurrentUser();
    updateAuthUI();
  }

  // DOM加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ============================================
  // 导出API
  // ============================================

  window.authService = {
    getCurrentUser,
    signInWithOAuth,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    onAuthStateChange,
    getUserProfile
  };
})();

