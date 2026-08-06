// ── Service Worker cho PWA QuanLyDuAn ────────────────────────────────────
// Chiến lược: Cache-First cho static assets, Network-First cho API/Firebase

const CACHE_NAME = 'qlda-fdi-v4';
const BASE = location.pathname.startsWith('/QuanLyTaiLieu') ? '/QuanLyTaiLieu' : '';

// Các file cần cache ngay khi SW install (App Shell)
const PRECACHE_URLS = [
  BASE + '/',
  BASE + '/index.html',
];

// ── Install: cache App Shell ──────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn('[SW] Precache một số URL thất bại:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: xóa cache cũ ───────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// ── Fetch: chiến lược thông minh theo loại request ───────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Bỏ qua: Firebase, Chrome extension, non-HTTP
  if (
    !request.url.startsWith('http') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('firestore') ||
    url.hostname.includes('identitytoolkit') ||
    request.url.includes('chrome-extension')
  ) {
    return;
  }

  // Static assets (JS, CSS, images, fonts): Cache-First
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'image' ||
    request.destination === 'font' ||
    url.pathname.includes('/assets/')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => cached || new Response('', { status: 503 }));
      })
    );
    return;
  }

  // HTML pages: Network-First, fallback to cache
  if (request.destination === 'document' || request.headers.get('Accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          return caches.match(request) || caches.match(BASE + '/') || caches.match(BASE + '/index.html');
        })
    );
    return;
  }
});
