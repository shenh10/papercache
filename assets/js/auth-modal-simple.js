/**
 * 认证模态框组件 - 使用SimpleAuth系统
 *
 * 功能：
 * - 登录/注册表单处理
 * - 错误提示
 * - 加载状态管理
 */

(function() {
  'use strict';

  // DOM元素
  let authModal = null;
  let loginForm = null;
  let registerForm = null;
  let resetForm = null;
  let loginTab = null;
  let registerTab = null;
  let resetTab = null;

  // 初始化认证模态框
  function initAuthModal() {
    // 查找所有可能的DOM元素
    authModal = document.getElementById('auth-modal');
    loginForm = document.getElementById('login-form');
    registerForm = document.getElementById('register-form');
    resetForm = document.getElementById('reset-password-form');
    loginTab = document.getElementById('login-tab');
    registerTab = document.getElementById('register-tab');
    resetTab = document.getElementById('reset-tab');

    if (!authModal) {
      console.log('AuthModal: 未找到认证模态框，跳过初始化');
      return;
    }

    console.log('AuthModal: 初始化认证模态框');

    // 设置表单事件监听器
    setupFormListeners();

    // 设置标签页切换
    setupTabSwitching();

    // 设置模态框外部点击关闭
    setupModalCloseHandlers();
  }

  // 设置表单监听器
  function setupFormListeners() {
    // 登录表单
    if (loginForm) {
      loginForm.addEventListener('submit', handleLogin);
    }

    // 注册表单
    if (registerForm) {
      registerForm.addEventListener('submit', handleRegister);
    }

    // 重置密码表单
    if (resetForm) {
      resetForm.addEventListener('submit', handlePasswordReset);
    }
  }

  // 设置标签页切换
  function setupTabSwitching() {
    if (loginTab) {
      loginTab.addEventListener('click', () => switchTab('login'));
    }
    if (registerTab) {
      registerTab.addEventListener('click', () => switchTab('register'));
    }
    if (resetTab) {
      resetTab.addEventListener('click', () => switchTab('reset'));
    }
  }

  // 设置模态框关闭处理
  function setupModalCloseHandlers() {
    // 点击外部关闭
    authModal.addEventListener('click', (e) => {
      if (e.target === authModal) {
        closeAuthModal();
      }
    });

    // ESC键关闭
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && authModal.style.display === 'block') {
        closeAuthModal();
      }
    });

    // 关闭按钮
    const closeBtn = authModal.querySelector('.close-modal');
    if (closeBtn) {
      closeBtn.addEventListener('click', closeAuthModal);
    }
  }

  // 切换标签页
  function switchTab(tabName) {
    // 移除所有标签页的active类
    [loginTab, registerTab, resetTab].forEach(tab => {
      if (tab) tab.classList.remove('active');
    });

    // 隐藏所有表单
    [loginForm, registerForm, resetForm].forEach(form => {
      if (form) form.style.display = 'none';
    });
    
    // 如果从重置密码标签页切换走，恢复表单显示
    if (resetForm && tabName !== 'reset') {
      const formGroup = resetForm.querySelector('.auth-form-group');
      const submitBtn = resetForm.querySelector('button[type="submit"]');
      if (formGroup) formGroup.style.display = '';
      if (submitBtn) submitBtn.style.display = '';
      clearErrors();
    }

    // 激活选中的标签页和表单
    switch (tabName) {
      case 'login':
        if (loginTab) loginTab.classList.add('active');
        if (loginForm) loginForm.style.display = 'block';
        break;
      case 'register':
        if (registerTab) registerTab.classList.add('active');
        if (registerForm) registerForm.style.display = 'block';
        break;
      case 'reset':
        if (resetTab) resetTab.classList.add('active');
        if (resetForm) resetForm.style.display = 'block';
        break;
    }

    // 清除错误消息
    clearErrors();
  }

  // 显示认证模态框
  window.showAuthModal = function(tab = 'login') {
    if (!authModal) {
      console.error('AuthModal: 认证模态框未找到');
      return;
    }

    switchTab(tab);
    authModal.style.display = 'block';
    document.body.style.overflow = 'hidden'; // 防止背景滚动

    // 聚焦到第一个输入框
    setTimeout(() => {
      const activeForm = authModal.querySelector('form[style*="block"]');
      if (activeForm) {
        const firstInput = activeForm.querySelector('input');
        if (firstInput) firstInput.focus();
      }
    }, 100);
  };

  // 关闭认证模态框
  function closeAuthModal() {
    if (authModal) {
      authModal.style.display = 'none';
      document.body.style.overflow = ''; // 恢复滚动
      clearErrors();
      clearForms();
    }
  }

  // 清除错误消息
  function clearErrors() {
    const errorElements = authModal.querySelectorAll('.error-message');
    errorElements.forEach(el => el.remove());
  }

  // 清除表单数据
  function clearForms() {
    const forms = authModal.querySelectorAll('form');
    forms.forEach(form => form.reset());
  }

  // 显示错误消息或成功消息
  function showError(form, message, type = 'error') {
    clearErrors();

    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    
    // 根据类型设置不同的样式
    if (type === 'success') {
      errorDiv.style.cssText = `
        color: #065f46;
        font-size: 14px;
        margin-top: 5px;
        padding: 10px;
        background-color: #d1fae5;
        border: 1px solid #10b981;
        border-radius: 4px;
      `;
    } else {
      errorDiv.style.cssText = `
        color: #dc3545;
        font-size: 14px;
        margin-top: 5px;
        padding: 10px;
        background-color: #f8d7da;
        border: 1px solid #f5c6cb;
        border-radius: 4px;
      `;
    }

    form.appendChild(errorDiv);
  }

  // 显示加载状态
  function setLoading(form, loading = true) {
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
      if (loading) {
        submitBtn.disabled = true;
        submitBtn.textContent = '登录中...';
        submitBtn.style.opacity = '0.6';
      } else {
        submitBtn.disabled = false;
        submitBtn.textContent = form.id === 'register-form' ? '注册' : '登录';
        submitBtn.style.opacity = '1';
      }
    }
  }

  // 处理登录
  async function handleLogin(e) {
    e.preventDefault();

    if (!window.SimpleAuth) {
      showError(loginForm, '认证系统未加载完成，请稍后再试');
      return;
    }

    const email = loginForm.querySelector('input[name="email"]').value;
    const password = loginForm.querySelector('input[name="password"]').value;

    if (!email || !password) {
      showError(loginForm, '请填写邮箱和密码');
      return;
    }

    setLoading(loginForm, true);
    clearErrors();

    try {
      await window.SimpleAuth.login(email, password);
      console.log('AuthModal: 登录成功');
      closeAuthModal();

      // 可以在这里添加成功提示
      showSuccessMessage('登录成功！');

    } catch (error) {
      console.error('AuthModal: 登录失败', error);
      let errorMessage = '登录失败，请检查邮箱和密码';

      if (error.message.includes('Invalid login credentials')) {
        errorMessage = '邮箱或密码错误';
      } else if (error.message.includes('Email not confirmed')) {
        errorMessage = '请先验证邮箱';
      } else if (error.message.includes('Too many requests')) {
        errorMessage = '请求过于频繁，请稍后再试';
      }

      showError(loginForm, errorMessage);
    } finally {
      setLoading(loginForm, false);
    }
  }

  // 处理注册
  async function handleRegister(e) {
    e.preventDefault();

    const email = registerForm.querySelector('input[name="email"]').value;
    const password = registerForm.querySelector('input[name="password"]').value;
    const confirmPassword = registerForm.querySelector('input[name="confirm-password"]').value;

    if (!email || !password || !confirmPassword) {
      showError(registerForm, '请填写所有字段');
      return;
    }

    if (password.length < 6) {
      showError(registerForm, '密码至少需要6个字符');
      return;
    }

    if (password !== confirmPassword) {
      showError(registerForm, '两次输入的密码不一致');
      return;
    }

    setLoading(registerForm, true);
    clearErrors();

    try {
      // 使用Supabase直接注册（SimpleAuth暂不包含注册功能）
      const supabase = window.getSupabaseClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password
      });

      if (error) throw error;

      console.log('AuthModal: 注册成功');
      closeAuthModal();

      // 显示验证邮箱提示
      showSuccessMessage('注册成功！请检查邮箱验证链接。');

    } catch (error) {
      console.error('AuthModal: 注册失败', error);
      let errorMessage = '注册失败，请稍后再试';

      if (error.message.includes('User already registered')) {
        errorMessage = '该邮箱已被注册';
      } else if (error.message.includes('Password should be')) {
        errorMessage = '密码格式不符合要求';
      }

      showError(registerForm, errorMessage);
    } finally {
      setLoading(registerForm, false);
    }
  }

  // 处理密码重置
  async function handlePasswordReset(e) {
    e.preventDefault();

    const email = resetForm.querySelector('input[name="email"]').value;

    if (!email) {
      showError(resetForm, '请填写邮箱地址');
      return;
    }

    setLoading(resetForm, true);
    clearErrors();

    try {
      const supabase = window.getSupabaseClient();
      
      // 构建重置密码的重定向URL
      const baseurl = window.PC_BASEURL || '';
      const redirectTo = window.location.origin + baseurl + '/auth/reset-password.html';
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectTo
      });

      if (error) throw error;

      console.log('AuthModal: 重置邮件发送成功');
      
      // 隐藏表单，显示成功提示
      const formGroup = resetForm.querySelector('.auth-form-group');
      const submitBtn = resetForm.querySelector('button[type="submit"]');
      if (formGroup) formGroup.style.display = 'none';
      if (submitBtn) submitBtn.style.display = 'none';
      
      // 显示成功消息（不关闭模态框，让用户看到提示）
      showError(resetForm, '密码重置链接已发送到您的邮箱，请查收。', 'success');

    } catch (error) {
      console.error('AuthModal: 发送重置邮件失败', error);
      showError(resetForm, '发送重置邮件失败，请检查邮箱地址');
    } finally {
      setLoading(resetForm, false);
    }
  }

  // 显示成功消息
  function showSuccessMessage(message) {
    const successDiv = document.createElement('div');
    successDiv.textContent = message;
    successDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background-color: #28a745;
      color: white;
      padding: 15px 20px;
      border-radius: 5px;
      z-index: 10000;
      font-size: 14px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    `;

    document.body.appendChild(successDiv);

    // 3秒后自动移除
    setTimeout(() => {
      if (successDiv.parentNode) {
        successDiv.parentNode.removeChild(successDiv);
      }
    }, 3000);
  }

  // 页面加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuthModal);
  } else {
    initAuthModal();
  }

  // Turbolinks页面加载时重新初始化
  document.addEventListener('turbolinks:load', initAuthModal);

  console.log('AuthModal: 🚀 认证模态框组件已加载');

})();