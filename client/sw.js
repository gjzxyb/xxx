/**
 * Service Worker - PWA离线支持
 * 版本: 1.1.0
 */

const CACHE_NAME = 'student-selection-v1.1.0';
const RUNTIME_CACHE = 'runtime-cache-v1.1.0';

// 需要缓存的静态资源
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/selection.html',
  '/admin.html',
  '/css/style.css',
  '/js/api.js',
  '/manifest.json',
  // 添加其他关键资源
];

// 需要缓存的API端点（仅GET请求）
const API_CACHE_PATTERNS = [
  '/api/subjects',
  '/api/selections/status',
  '/api/selections/my'
];

// 安装事件 - 缓存静态资源
self.addEventListener('install', (event) => {
  console.log('[SW] 安装中...');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] 缓存静态资源');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] 安装完成');
        return self.skipWaiting(); // 立即激活新的SW
      })
      .catch((error) => {
        console.error('[SW] 安装失败:', error);
      })
  );
});

// 激活事件 - 清理旧缓存
self.addEventListener('activate', (event) => {
  console.log('[SW] 激活中...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
              console.log('[SW] 删除旧缓存:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] 激活完成');
        return self.clients.claim(); // 立即控制所有页面
      })
  );
});

// 拦截请求 - 实现缓存策略
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 跳过非GET请求
  if (request.method !== 'GET') {
    return;
  }

  // 跳过chrome扩展请求
  if (url.protocol === 'chrome-extension:') {
    return;
  }

  // 跳过外部字体资源（避免 CSP 冲突）
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(fetch(request));
    return;
  }

  // API请求 - 网络优先，失败时使用缓存
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // 静态资源 - 缓存优先，失败时使用网络
  event.respondWith(cacheFirstStrategy(request));
});

/**
 * 缓存优先策略（适用于静态资源）
 */
async function cacheFirstStrategy(request) {
  try {
    // 先查找缓存
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('[SW] 从缓存返回:', request.url);
      return cachedResponse;
    }

    // 缓存未命中，从网络获取
    console.log('[SW] 从网络获取:', request.url);
    const networkResponse = await fetch(request);

    // 缓存成功的响应
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.error('[SW] 请求失败:', request.url, error);

    // 返回离线页面（如果有）
    if (request.mode === 'navigate') {
      const offlineResponse = await caches.match('/offline.html');
      if (offlineResponse) {
        return offlineResponse;
      }
    }

    // 返回基本错误响应
    return new Response('网络错误，请检查网络连接', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: new Headers({
        'Content-Type': 'text/plain; charset=utf-8'
      })
    });
  }
}

/**
 * 网络优先策略（适用于API请求）
 */
async function networkFirstStrategy(request) {
  try {
    // 先尝试从网络获取
    console.log('[SW] API请求 - 网络优先:', request.url);
    const networkResponse = await fetch(request);

    // 缓存成功的GET请求响应
    if (networkResponse.ok && shouldCacheAPI(request.url)) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log('[SW] 网络失败，尝试缓存:', request.url);

    // 网络失败，尝试从缓存获取
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('[SW] 从缓存返回API响应:', request.url);
      return cachedResponse;
    }

    // 返回错误响应
    return new Response(JSON.stringify({
      code: 503,
      message: '网络连接失败，请检查网络后重试',
      offline: true
    }), {
      status: 503,
      headers: new Headers({
        'Content-Type': 'application/json; charset=utf-8'
      })
    });
  }
}

/**
 * 判断API是否应该被缓存
 */
function shouldCacheAPI(url) {
  return API_CACHE_PATTERNS.some(pattern => url.includes(pattern));
}

// 后台同步 - 离线时提交的数据
self.addEventListener('sync', (event) => {
  console.log('[SW] 后台同步:', event.tag);

  if (event.tag === 'sync-selections') {
    event.waitUntil(syncSelections());
  }
});

/**
 * 同步离线时提交的选科数据
 */
async function syncSelections() {
  try {
    // 从IndexedDB获取待同步的数据
    // 这里需要配合前端的IndexedDB实现
    console.log('[SW] 同步选科数据...');

    // 实际同步逻辑
    // const pendingData = await getPendingSelections();
    // await submitSelections(pendingData);

    console.log('[SW] 同步完成');
  } catch (error) {
    console.error('[SW] 同步失败:', error);
    throw error; // 重新抛出错误，触发重试
  }
}

// 推送通知
self.addEventListener('push', (event) => {
  console.log('[SW] 收到推送通知');

  const data = event.data ? event.data.json() : {};
  const title = data.title || '选科系统通知';
  const options = {
    body: data.body || '您有新的消息',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [200, 100, 200],
    data: data.url || '/',
    actions: [
      {
        action: 'open',
        title: '查看'
      },
      {
        action: 'close',
        title: '关闭'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// 通知点击事件
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] 通知被点击:', event.action);

  event.notification.close();

  if (event.action === 'open') {
    const urlToOpen = event.notification.data || '/';

    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          // 如果已有窗口打开，聚焦它
          for (const client of clientList) {
            if (client.url === urlToOpen && 'focus' in client) {
              return client.focus();
            }
          }

          // 否则打开新窗口
          if (clients.openWindow) {
            return clients.openWindow(urlToOpen);
          }
        })
    );
  }
});

// 消息事件 - 与页面通信
self.addEventListener('message', (event) => {
  console.log('[SW] 收到消息:', event.data);

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(RUNTIME_CACHE)
        .then((cache) => cache.addAll(event.data.urls))
    );
  }

  if (event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys()
        .then((cacheNames) => {
          return Promise.all(
            cacheNames.map((cacheName) => caches.delete(cacheName))
          );
        })
    );
  }
});

console.log('[SW] Service Worker已加载');
