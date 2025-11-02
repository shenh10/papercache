// 用户认证服务模块
(function() {
  'use strict';

  // 等待Supabase客户端初始化
  function getSupabaseClient() {
    if (window.getSupabaseClient) {
      return window.getSupabaseClient();
    }
    return null;
  }

  const supabase = getSupabaseClient();
  
  if (!supabase) {
    console.warn('Supabase客户端未初始化，等待初始化...');
    // 等待客户端初始化，最多等待3秒
    let waitCount = 0;
    const checkInterval = setInterval(() => {
      waitCount++;
      const client = getSupabaseClient();
      if (client) {
        clearInterval(checkInterval);
        initAuthService(client);
      } else if (waitCount > 30) {
        clearInterval(checkInterval);
        console.error('Supabase客户端初始化超时，认证功能不可用');
      }
    }, 100);
    return;
  }
  
  initAuthService(supabase);
  
  function initAuthService(supabase) {
    // ============================================
    // 认证状态管理
    // ============================================
    
    let currentUser = null;
    let authStateListeners = [];

    // 获取当前用户
    async function getCurrentUser() {
      try {
        // 先尝试从session获取（更快，从localStorage读取，这是持久化的状态）
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.warn('获取session失败:', sessionError);
        }
        
        // 如果有session，使用session中的user（这是持久化的状态）
        if (session?.user) {
          console.log('getCurrentUser: 从session获取用户', session.user.email);
          
          // 获取用户档案（如果不存在会自动创建）
          const profile = await getUserProfile(session.user.id);
          
          currentUser = {
            ...session.user,
            profile: profile
          };
          return currentUser;
        }
        
        // 如果没有session，再尝试getUser（可能token已过期但refresh token还有效）
        console.log('getCurrentUser: session为空，尝试getUser');
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) {
          // 如果getUser也失败，清除状态
          console.log('getCurrentUser: getUser失败', error.message);
          currentUser = null;
          return null;
        }
        
        // 如果用户存在，获取用户档案（如果不存在会自动创建）
        if (user) {
          console.log('getCurrentUser: getUser成功', user.email);
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

    // 获取用户档案（如果不存在则自动创建）
    async function getUserProfile(userId) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
        
        if (error) {
          // 如果错误是"没有找到记录"（PGRST116），尝试自动创建
          if (error.code === 'PGRST116' || error.message?.includes('0 rows')) {
            console.log('用户档案不存在，尝试自动创建:', userId);
            
            // 尝试从 auth.users 获取用户基本信息
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
              return null;
            }
            
            // 创建默认 profile
            const defaultProfile = {
              id: userId,
              username: user.user_metadata?.username || user.email?.split('@')[0] || 'user',
              avatar_url: user.user_metadata?.avatar_url || null,
              full_name: user.user_metadata?.full_name || null,
              bio: null
            };
            
            // 尝试插入（如果触发器已创建，可能会冲突，使用 upsert）
            // 注意：upsert 需要用户有 INSERT 权限（RLS策略允许）
            const { data: insertedData, error: insertError } = await supabase
              .from('profiles')
              .upsert(defaultProfile, { onConflict: 'id' })
              .select()
              .single();
            
            if (insertError) {
              console.warn('自动创建用户档案失败:', insertError);
              // 如果upsert失败（可能是RLS限制），尝试只插入
              const { data: insertedOnly, error: insertOnlyError } = await supabase
                .from('profiles')
                .insert(defaultProfile)
                .select()
                .single();
              
              if (insertOnlyError) {
                console.warn('直接插入用户档案也失败:', insertOnlyError);
                // 即使创建失败，也返回一个默认的 profile 对象（避免阻塞登录流程）
                return defaultProfile;
              }
              
              return insertedOnly || defaultProfile;
            }
            
            return insertedData || defaultProfile;
          }
          
          // 其他错误，直接抛出
          throw error;
        }
        
        return data;
      } catch (error) {
        console.error('获取用户档案失败:', error);
        // 即使出错，也返回一个默认的 profile 对象，避免阻塞登录流程
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          return {
            id: userId,
            username: user.user_metadata?.username || user.email?.split('@')[0] || 'user',
            avatar_url: user.user_metadata?.avatar_url || null,
            full_name: user.user_metadata?.full_name || null,
            bio: null
          };
        }
        return null;
      }
    }

    // 监听认证状态变化
    supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.email);
      
      // 处理邮箱验证确认
      if (event === 'SIGNUP_CONFIRMED') {
        console.log('邮箱验证成功');
        // 获取用户并更新状态
        currentUser = await getCurrentUser();
        if (session?.user) {
          await logUserLogin(session.user.id);
        }
        // 清除URL hash（如果存在）
        if (window.location.hash && window.location.hash.includes('access_token')) {
          setTimeout(() => {
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
          }, 100);
        }
      } else if (event === 'PASSWORD_RECOVERY') {
        console.log('密码重置链接已确认');
        // 密码重置流程，由 reset-password.html 页面处理
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        currentUser = await getCurrentUser();
        // 记录登录日志
        if (session?.user) {
          await logUserLogin(session.user.id);
        }
        // 如果是通过URL hash登录的，清除hash
        if (window.location.hash && window.location.hash.includes('access_token')) {
          setTimeout(() => {
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
          }, 100);
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
      // 立即调用一次（如果用户已经加载）
      if (currentUser !== undefined && currentUser !== null) {
        callback(currentUser, 'SIGNED_IN');
      } else if (currentUser === null) {
        // 如果明确是 null（已检查过但无用户），也调用一次
        callback(null, 'SIGNED_OUT');
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
        
        // 立即更新当前用户状态
        if (data.user) {
          currentUser = await getCurrentUser();
          // 记录登录日志（异步，不阻塞）
          logUserLogin(data.user.id).catch(err => {
            console.warn('记录登录日志失败:', err);
          });
          // 通知所有监听器
          authStateListeners.forEach(listener => {
            try {
              listener(currentUser, 'SIGNED_IN');
            } catch (e) {
              console.error('Auth state listener error:', e);
            }
          });
          updateAuthUI();
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
        // 使用验证页面作为邮箱验证回调地址
        const redirectTo = window.location.origin + '/papercache/auth/verify.html';
        
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectTo,
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
    // 密码重置
    // ============================================

    // 发送密码重置邮件
    async function resetPasswordForEmail(email) {
      try {
        // 使用重置页面作为重定向地址
        const redirectTo = window.location.origin + '/papercache/auth/reset-password.html';
        
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: redirectTo
        });
        
        if (error) throw error;
        return { success: true };
      } catch (error) {
        console.error('发送密码重置邮件失败:', error);
        return { success: false, error: error.message };
      }
    }

    // 更新密码
    async function updatePassword(newPassword) {
      try {
        const { error } = await supabase.auth.updateUser({
          password: newPassword
        });
        
        if (error) throw error;
        return { success: true };
      } catch (error) {
        console.error('更新密码失败:', error);
        return { success: false, error: error.message };
      }
    }

    // ============================================
    // 重发验证邮件
    // ============================================

    async function resendConfirmationEmail(email) {
      try {
        // 使用验证页面作为重定向地址
        const redirectTo = window.location.origin + '/papercache/auth/verify.html';
        
        const { error } = await supabase.auth.resend({
          type: 'signup',
          email: email,
          options: {
            emailRedirectTo: redirectTo
          }
        });
        
        if (error) throw error;
        return { success: true };
      } catch (error) {
        console.error('重发验证邮件失败:', error);
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
      // 检查URL hash中是否有认证token（邮箱验证回调）
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const type = hashParams.get('type');
      
      // 如果当前页面不是验证页面，但有验证token，重定向到验证页面
      if (accessToken && type === 'signup' && !window.location.pathname.includes('/auth/verify')) {
        const baseUrl = window.location.pathname.startsWith('/papercache') 
          ? '/papercache' 
          : '';
        window.location.href = baseUrl + '/auth/verify.html' + window.location.hash;
        return;
      }
      
      try {
        // 先快速检查session（从localStorage读取，不需要网络请求）
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          // 如果有session，立即设置用户状态（即使profile还没加载）
          currentUser = {
            ...session.user,
            profile: null // 稍后异步加载
          };
          
          // 立即通知监听器（不等待profile加载）
          authStateListeners.forEach(listener => {
            try {
              listener(currentUser, 'SIGNED_IN');
            } catch (e) {
              console.error('Auth state listener error:', e);
            }
          });
          updateAuthUI();
          
          // 异步加载完整的用户信息（包括profile）
          getCurrentUser().then(fullUser => {
            if (fullUser) {
              currentUser = fullUser;
              // 再次通知监听器（更新后的完整信息）
              authStateListeners.forEach(listener => {
                try {
                  listener(currentUser, 'SIGNED_IN');
                } catch (e) {
                  console.error('Auth state listener error:', e);
                }
              });
              updateAuthUI();
            }
          }).catch(err => {
            console.warn('加载完整用户信息失败:', err);
            // 即使profile加载失败，用户仍然已登录
          });
        } else {
          currentUser = null;
          // 通知所有监听器
          authStateListeners.forEach(listener => {
            try {
              listener(null, 'SIGNED_OUT');
            } catch (e) {
              console.error('Auth state listener error:', e);
            }
          });
          updateAuthUI();
        }
      } catch (error) {
        console.error('初始化认证状态失败:', error);
        currentUser = null;
        // 通知所有监听器
        authStateListeners.forEach(listener => {
          try {
            listener(null, 'SIGNED_OUT');
          } catch (e) {
            console.error('Auth state listener error:', e);
          }
        });
        updateAuthUI();
      }
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
      resetPasswordForEmail,
      updatePassword,
      resendConfirmationEmail,
      signOut,
      onAuthStateChange,
      getUserProfile
    };
  }
})();
