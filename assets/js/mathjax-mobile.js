/**
 * MathJax 移动端优化脚本
 * 提供更好的移动端数学公式渲染体验
 */

(function() {
  'use strict';
  
  // 检测是否为移动设备
  function isMobile() {
    return window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }
  
  // 移动端MathJax配置
  function configureMathJaxForMobile() {
    if (!window.MathJax) return;
    
    // 更新配置以优化移动端
    MathJax.config = MathJax.config || {};
    MathJax.config.chtml = MathJax.config.chtml || {};
    
    // 移动端特定配置
    Object.assign(MathJax.config.chtml, {
      scale: 0.9,
      minScale: 0.5,
      maxScale: 1.5,
      adaptiveCSS: true,
      linebreaks: {
        automatic: true,
        width: 'container'
      },
      mtextInheritFont: true
    });
    
    // 添加移动端样式
    const style = document.createElement('style');
    style.textContent = `
      @media (max-width: 768px) {
        .MathJax {
          font-size: 0.9em !important;
          line-height: 1.3 !important;
          max-width: 100% !important;
          overflow-x: auto !important;
          overflow-y: hidden !important;
        }
        
        .MathJax_Display {
          margin: 1em 0 !important;
          padding: 0.5em !important;
          overflow-x: auto !important;
          -webkit-overflow-scrolling: touch !important;
        }
        
        .MathJax_SVG {
          max-width: 100% !important;
          height: auto !important;
        }
        
        /* 长公式滚动优化 */
        .MathJax_Display .MathJax {
          white-space: nowrap !important;
          overflow-x: auto !important;
          -webkit-overflow-scrolling: touch !important;
        }
      }
      
      @media (max-width: 480px) {
        .MathJax {
          font-size: 0.8em !important;
          line-height: 1.2 !important;
        }
        
        .MathJax_Display {
          margin: 0.8em 0 !important;
          padding: 0.3em !important;
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  // 处理数学公式的触摸滚动
  function enhanceMathScrolling() {
    if (!isMobile()) return;
    
    const mathElements = document.querySelectorAll('.MathJax_Display, .MathJax');
    mathElements.forEach(element => {
      // 添加触摸滚动支持
      element.style.webkitOverflowScrolling = 'touch';
      element.style.overflowX = 'auto';
      
      // 添加滚动指示器
      if (element.scrollWidth > element.clientWidth) {
        element.style.background = 'linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.1) 100%)';
        element.style.backgroundSize = '20px 100%';
        element.style.backgroundRepeat = 'no-repeat';
        element.style.backgroundPosition = 'right';
      }
    });
  }
  
  // 监听窗口大小变化
  function handleResize() {
    if (isMobile()) {
      configureMathJaxForMobile();
      enhanceMathScrolling();
    }
  }
  
  // 初始化
  function init() {
    if (isMobile()) {
      configureMathJaxForMobile();
      
      // 等待MathJax加载完成
      if (window.MathJax && window.MathJax.startup) {
        MathJax.startup.promise.then(() => {
          enhanceMathScrolling();
        });
      } else {
        // 如果MathJax还没加载，等待它加载
        const checkMathJax = setInterval(() => {
          if (window.MathJax && window.MathJax.startup) {
            clearInterval(checkMathJax);
            MathJax.startup.promise.then(() => {
              enhanceMathScrolling();
            });
          }
        }, 100);
        
        // 10秒后停止检查
        setTimeout(() => clearInterval(checkMathJax), 10000);
      }
    }
    
    // 监听窗口大小变化
    window.addEventListener('resize', handleResize);
  }
  
  // 页面加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  // 导出函数供外部使用
  window.MathJaxMobile = {
    configure: configureMathJaxForMobile,
    enhance: enhanceMathScrolling,
    isMobile: isMobile
  };
})();


