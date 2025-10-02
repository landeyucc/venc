// 缓存版本和要缓存的文件列表
const CACHE_VERSION = 'v10'; // 增加版本号以强制更新缓存，添加了自动更新功能
const CACHE_FILES = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/main.js',
  '/js/i18n.js',
  '/js/cryptoWorker.js',
  '/js/footer.js',
  '/lang/en-US.js',
  '/lang/zh-CN.js',
  '/lang/zh-TW.js',
  '/img/venc.ico',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// 安装Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => {
        console.log('缓存文件...');
        return cache.addAll(CACHE_FILES);
      })
      .then(() => {
        console.log('所有文件已缓存');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('缓存失败:', error);
      })
  );
});

// 激活Service Worker并清理旧缓存
self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      // 删除旧缓存
      caches.keys().then(cacheNames => {
        console.log('当前缓存版本:', CACHE_VERSION);
        console.log('发现的缓存列表:', cacheNames);
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_VERSION) {
              console.log('删除旧缓存:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // 强制所有客户端更新到最新版本
      self.clients.claim()
    ]).then(() => {
      console.log('Service Worker已激活，旧缓存已清理，所有客户端已更新');
      // 通知所有已激活的客户端刷新页面以获取最新资源
      return self.clients.matchAll().then(clients => {
        console.log('发现的客户端数量:', clients.length);
        clients.forEach(client => {
          console.log('发送缓存更新通知到客户端');
          client.postMessage({ type: 'CACHE_UPDATED' });
        });
      });
    })
  );
});

// 处理网络请求 - 使用优化的缓存策略解决PWA刷新和数据冲突问题
self.addEventListener('fetch', event => {
  // 记录请求信息，便于调试
  console.log('Service Worker处理请求:', event.request.url);
  // 对于index.html、main.js、cryptoWorker.js等核心文件使用网络优先策略
  const isCoreResource = event.request.url.includes('index.html') ||
                        event.request.url.includes('main.js') || 
                        event.request.url.includes('cryptoWorker.js') ||
                        event.request.url.includes('i18n.js') ||
                        event.request.url.includes('js/config.js'); // 包含配置相关文件
  
  if (isCoreResource) {
    // 核心资源使用网络优先策略，确保始终加载最新版本
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' }).then(networkResponse => {
        if (!networkResponse || networkResponse.status !== 200) {
          // 如果网络请求失败，则尝试从缓存中获取
          return caches.match(event.request);
        }
        
        // 克隆响应并更新缓存
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_VERSION)
          .then(cache => {
            // 先删除旧缓存，再添加新缓存
            cache.delete(event.request).then(() => {
              cache.put(event.request, responseToCache);
            });
          });
          
        return networkResponse;
      }).catch(() => {
        // 网络请求完全失败，从缓存中获取
        return caches.match(event.request);
      })
    );
  } else {
    // 其他资源使用缓存优先策略，但添加时间检查，定期更新
    event.respondWith(
      caches.match(event.request).then(cacheResponse => {
        // 克隆一份缓存响应，因为它只能被读取一次
        const clonedCacheResponse = cacheResponse ? cacheResponse.clone() : null;
        
        // 获取缓存时间（如果有）
        const cacheDate = clonedCacheResponse ? new Date(clonedCacheResponse.headers.get('date') || 0) : null;
        const now = new Date();
        const oneDay = 24 * 60 * 60 * 1000;
        
        // 如果缓存存在且未过期（小于1天），则使用缓存
        if (clonedCacheResponse && cacheDate && (now - cacheDate) < oneDay) {
          return clonedCacheResponse;
        }
        
        // 否则发送网络请求
        return fetch(event.request).then(networkResponse => {
          // 检查响应是否有效
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            // 如果网络请求失败且有旧缓存，则返回旧缓存
            return clonedCacheResponse || networkResponse;
          }
          
          // 克隆响应，因为它只能被使用一次
          const responseToCache = networkResponse.clone();
          
          // 将新的响应添加到缓存中
          caches.open(CACHE_VERSION)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
          
          return networkResponse;
        }).catch(() => {
          // 网络请求完全失败，如果有旧缓存则返回旧缓存
          return clonedCacheResponse;
        });
      })
    );
  }
});