// ── Service Worker cho PWA FDI PM ────────────────────────────
// Chiến lược: Network-First để luôn tải phiên bản mới nhất từ server ngay lập tức

const CACHE_NAME = 'fdi-pm-v' + Date.now();

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((k) => caches.delete(k)));
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;

  // Bỏ qua các API Firestore, Firebase, Google
  if (
    !url.startsWith('http') ||
    url.includes('firestore') ||
    url.includes('firebase') ||
    url.includes('googleapis') ||
    url.includes('identitytoolkit')
  ) {
    return;
  }

  // Network-First cho toàn bộ: Luôn tải mới từ server, chỉ dùng cache khi offline
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
