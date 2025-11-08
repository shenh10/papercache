/**
 * Geek风格英雄区域背景动画
 * 包含粒子效果、网格线动画和光效
 */

(function() {
  'use strict';

  function initGeekHeroBackground() {
    const heroSection = document.querySelector('.hero-section');
    if (!heroSection) return;

    // 检查是否已经有canvas
    if (heroSection.querySelector('.geek-background-canvas')) return;

    // 创建canvas容器
    const canvasContainer = document.createElement('div');
    canvasContainer.className = 'geek-background-container';
    canvasContainer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      overflow: hidden;
      z-index: 1;
      pointer-events: none;
    `;

    // 创建主canvas
    const canvas = document.createElement('canvas');
    canvas.className = 'geek-background-canvas';
    canvas.style.cssText = `
      width: 100%;
      height: 100%;
      display: block;
    `;
    
    canvasContainer.appendChild(canvas);
    heroSection.insertBefore(canvasContainer, heroSection.firstChild);

    const ctx = canvas.getContext('2d');
    let animationFrameId;

    // 设置canvas尺寸
    function resizeCanvas() {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // 粒子系统 - 更精致的版本
    class Particle {
      constructor() {
        this.reset();
      }

      reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 1.5 + 0.3;
        this.speedX = (Math.random() - 0.5) * 0.3;
        this.speedY = (Math.random() - 0.5) * 0.3;
        this.opacity = Math.random() * 0.4 + 0.15;
        this.life = Math.random();
        this.hue = 185 + Math.random() * 25; // 青色/蓝色调 (185-210)
      }

      update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.life += 0.005;

        if (this.life > 1) {
          this.reset();
        }

        // 边界检测
        if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
        if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;
      }

      draw() {
        ctx.save();
        ctx.globalAlpha = this.opacity * (1 - this.life * 0.5);
        // 使用渐变填充，更精美
        const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * 2);
        gradient.addColorStop(0, `hsla(${this.hue}, 70%, 75%, ${this.opacity})`);
        gradient.addColorStop(0.5, `hsla(${this.hue}, 60%, 65%, ${this.opacity * 0.6})`);
        gradient.addColorStop(1, `hsla(${this.hue}, 50%, 55%, 0)`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // 网格线 - 更精致的样式
    class Grid {
      constructor() {
        this.gridSize = 60;
        this.offsetX = 0;
        this.offsetY = 0;
      }

      update() {
        this.offsetX += 0.2;
        this.offsetY += 0.2;
      }

      draw() {
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.15)';
        ctx.lineWidth = 0.8;

        // 垂直线
        for (let x = (this.offsetX % this.gridSize) - this.gridSize; x < canvas.width + this.gridSize; x += this.gridSize) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvas.height);
          ctx.stroke();
        }

        // 水平线
        for (let y = (this.offsetY % this.gridSize) - this.gridSize; y < canvas.height + this.gridSize; y += this.gridSize) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(canvas.width, y);
          ctx.stroke();
        }
      }
    }

    // 光线效果
    class LightBeam {
      constructor() {
        this.reset();
      }

      reset() {
        this.x = Math.random() * canvas.width;
        this.y = -50;
        this.width = Math.random() * 100 + 50;
        this.speed = Math.random() * 2 + 1;
        this.opacity = Math.random() * 0.3 + 0.1;
        this.angle = Math.random() * Math.PI * 2;
      }

      update() {
        this.y += this.speed;
        this.x += Math.sin(this.angle) * 0.5;
        
        if (this.y > canvas.height + 100) {
          this.reset();
        }
      }

      draw() {
        // 使用青色/蓝色调的渐变，科技感配色
        const gradient = ctx.createLinearGradient(this.x - this.width / 2, this.y, this.x + this.width / 2, this.y);
        gradient.addColorStop(0, `rgba(34, 211, 238, 0)`);
        gradient.addColorStop(0.5, `rgba(59, 130, 246, ${this.opacity})`);
        gradient.addColorStop(1, `rgba(14, 165, 233, 0)`);

        ctx.save();
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = gradient;
        ctx.fillRect(this.x - this.width / 2, this.y - 200, this.width, 400);
        ctx.restore();
      }
    }

    // 连接线效果 - 更精美的渐变连接
    function drawConnections(particles) {
      particles.forEach((p1, i) => {
        particles.slice(i + 1).forEach(p2 => {
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 120) {
            const opacity = 0.15 * (1 - distance / 120);
            const gradient = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
            gradient.addColorStop(0, `rgba(34, 211, 238, ${opacity})`);
            gradient.addColorStop(0.5, `rgba(59, 130, 246, ${opacity * 0.9})`);
            gradient.addColorStop(1, `rgba(14, 165, 233, ${opacity})`);
            ctx.strokeStyle = gradient;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        });
      });
    }

    // 初始化对象 - 减少粒子数量，更精致
    const particles = Array.from({ length: 60 }, () => new Particle());
    const grid = new Grid();
    const lightBeams = Array.from({ length: 2 }, () => new LightBeam());

    // 动画循环
    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 绘制背景渐变 - 科技感青色/蓝色配色
      const bgGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      bgGradient.addColorStop(0, 'rgba(34, 211, 238, 0.1)');
      bgGradient.addColorStop(0.5, 'rgba(59, 130, 246, 0.12)');
      bgGradient.addColorStop(1, 'rgba(14, 165, 233, 0.08)');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 更新和绘制
      grid.update();
      grid.draw();

      lightBeams.forEach(beam => {
        beam.update();
        beam.draw();
      });

      particles.forEach(particle => {
        particle.update();
        particle.draw();
      });

      drawConnections(particles);

      animationFrameId = requestAnimationFrame(animate);
    }

    // 启动动画
    animate();

    // 清理函数
    heroSection.addEventListener('DOMNodeRemoved', () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    }, { once: true });
  }

  // 初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGeekHeroBackground);
  } else {
    initGeekHeroBackground();
  }

  // 支持Turbolinks
  document.addEventListener('turbolinks:load', initGeekHeroBackground);
})();

