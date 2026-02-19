/**
 * PWA注册脚本
 * 注册Service Worker并处理更新
 */

// 检查浏览器是否支持Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    registerServiceWorker();
  });
}

/**
 * 注册Service Worker
 */
async function registerServiceWorker() {
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });

    console.log('✅ Service Worker注册成功:', registration.scope);

    // 监听更新
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      console.log('🔄 发现新版本Service Worker');

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // 新版本已安装，提示用户刷新
          showUpdateNotification();
        }
      });
    });

    // 检查更新
    setInterval(() => {
      registration.update();
    }, 60 * 60 * 1000); // 每小时检查一次

  } catch (error) {
    console.error('❌ Service Worker注册失败:', error);
  }
}

/**
 * 显示更新通知
 */
function showUpdateNotification() {
  const notification = document.createElement('div');
  notification.className = 'pwa-update-notification';
  notification.innerHTML = `
    <div class="pwa-update-content">
      <span>📱 发现新版本，点击更新</span>
      <button onclick="updateServiceWorker()">立即更新</button>
      <button onclick="this.parentElement.parentElement.remove()">稍后</button>
    </div>
  `;

  // 添加样式
  const style = document.createElement('style');
  style.textContent = `
    .pwa-update-notification {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%);
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
      z-index: 10000;
      animation: slideUp 0.3s ease-out;
    }

    .pwa-update-content {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .pwa-update-content button {
      background: white;
      color: #0ea5e9;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 600;
      transition: transform 0.2s;
    }

    .pwa-update-content button:hover {
      transform: scale(1.05);
    }

    .pwa-update-content button:last-child {
      background: transparent;
      color: white;
      border: 1px solid white;
    }

    @keyframes slideUp {
      from {
        transform: translateX(-50%) translateY(100px);
        opacity: 0;
      }
      to {
        transform: translateX(-50%) translateY(0);
        opacity: 1;
      }
    }

    @media (max-width: 768px) {
      .pwa-update-notification {
        left: 10px;
        right: 10px;
        transform: none;
      }

      .pwa-update-content {
        flex-direction: column;
        text-align: center;
      }
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(notification);
}

/**
 * 更新Service Worker
 */
window.updateServiceWorker = async function() {
  const registration = await navigator.serviceWorker.getRegistration();
  if (registration && registration.waiting) {
    // 通知Service Worker跳过等待
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });

    // 监听控制器变化
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  }
};

/**
 * 检查网络状态
 */
window.addEventListener('online', () => {
  console.log('🌐 网络已连接');
  showNetworkStatus('online');
});

window.addEventListener('offline', () => {
  console.log('📵 网络已断开');
  showNetworkStatus('offline');
});

/**
 * 显示网络状态提示
 */
function showNetworkStatus(status) {
  const existing = document.querySelector('.network-status');
  if (existing) {
    existing.remove();
  }

  const notification = document.createElement('div');
  notification.className = 'network-status';
  notification.innerHTML = status === 'online'
    ? '🌐 网络已连接'
    : '📵 离线模式 - 部分功能受限';

  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${status === 'online' ? '#10b981' : '#f59e0b'};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 10000;
    animation: slideIn 0.3s ease-out;
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

/**
 * 添加到主屏幕提示
 */
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  // 阻止默认提示
  e.preventDefault();
  deferredPrompt = e;

  // 显示自定义安装提示
  showInstallPrompt();
});

/**
 * 显示安装提示
 */
function showInstallPrompt() {
  // 检查是否已经显示过
  if (localStorage.getItem('pwa-install-dismissed')) {
    return;
  }

  const prompt = document.createElement('div');
  prompt.className = 'pwa-install-prompt';
  prompt.innerHTML = `
    <div class="pwa-install-content">
      <div class="pwa-install-icon">📱</div>
      <div class="pwa-install-text">
        <h3>安装选科系统</h3>
        <p>添加到主屏幕，获得更好的体验</p>
      </div>
      <div class="pwa-install-actions">
        <button id="pwa-install-btn" class="pwa-install-btn">安装</button>
        <button id="pwa-dismiss-btn" class="pwa-dismiss-btn">不了</button>
      </div>
    </div>
  `;

  const style = document.createElement('style');
  style.textContent = `
    .pwa-install-prompt {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: white;
      border-radius: 16px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
      z-index: 10000;
      max-width: 400px;
      animation: slideUp 0.3s ease-out;
    }

    .pwa-install-content {
      padding: 20px;
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .pwa-install-icon {
      font-size: 48px;
    }

    .pwa-install-text h3 {
      margin: 0 0 4px 0;
      font-size: 18px;
      color: #0f172a;
    }

    .pwa-install-text p {
      margin: 0;
      font-size: 14px;
      color: #64748b;
    }

    .pwa-install-actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .pwa-install-actions button {
      padding: 10px 20px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      transition: transform 0.2s;
    }

    .pwa-install-actions button:first-child {
      background: linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%);
      color: white;
    }

    .pwa-install-actions button:last-child {
      background: #f1f5f9;
      color: #64748b;
    }

    .pwa-install-actions button:hover {
      transform: scale(1.05);
    }

    @media (max-width: 768px) {
      .pwa-install-prompt {
        left: 10px;
        right: 10px;
        transform: none;
      }

      .pwa-install-content {
        flex-direction: column;
        text-align: center;
      }
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(prompt);

  // 绑定事件监听器
  const installBtn = document.getElementById('pwa-install-btn');
  const dismissBtn = document.getElementById('pwa-dismiss-btn');

  if (installBtn) {
    installBtn.addEventListener('click', installPWA);
  }

  if (dismissBtn) {
    dismissBtn.addEventListener('click', dismissInstallPrompt);
  }
}

/**
 * 安装PWA
 */
window.installPWA = async function() {
  if (!deferredPrompt) {
    return;
  }

  // 显示安装提示
  deferredPrompt.prompt();

  // 等待用户响应
  const { outcome } = await deferredPrompt.userChoice;
  console.log(`用户选择: ${outcome}`);

  // 清理
  deferredPrompt = null;
  document.querySelector('.pwa-install-prompt')?.remove();
};

/**
 * 关闭安装提示
 */
window.dismissInstallPrompt = function() {
  localStorage.setItem('pwa-install-dismissed', 'true');
  document.querySelector('.pwa-install-prompt')?.remove();
};

/**
 * 监听应用安装
 */
window.addEventListener('appinstalled', () => {
  console.log('✅ PWA已安装');
  deferredPrompt = null;
});

console.log('📱 PWA脚本已加载');
