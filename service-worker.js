// 缓存版本和要缓存的文件列表
const CACHE_VERSION = 'v1';
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
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_VERSION) {
              console.log('删除旧缓存:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker已激活');
        return self.clients.claim();
      })
  );
});

// 处理网络请求
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // 如果缓存中有匹配的响应，则返回缓存的响应
        if (response) {
          return response;
        }
        
        // 否则，发送网络请求
        return fetch(event.request)
          .then(networkResponse => {
            // 检查响应是否有效
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }
            
            // 克隆响应，因为它只能被使用一次
            const responseToCache = networkResponse.clone();
            
            // 将新的响应添加到缓存中
            caches.open(CACHE_VERSION)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            
            return networkResponse;
          });
      })
  );
});