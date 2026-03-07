// ============================================================
// LEGEND: Este script pertence ao "Horizonte Financeiro"
// LEGEND (PT): Service Worker para funcionalidade PWA (Progressive Web App).
//   - Cacheia assets estaticos para uso offline
//   - Intercepta requisicoes fetch para servir do cache
// ============================================================
const CACHE_NAME = 'horizonte-v1.7';
const ASSETS = [
  '/login.html',
  '/index.html',
  '/dashboard.html',
  '/investments.html',
  '/goals.html',
  '/history.html',
  '/transactions.html',
  '/register-item.html',
  '/style.css',
  '/script.js'
];

// Evento de instalacao: abre o cache e adiciona os arquivos iniciais
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Ignora chamadas de API e navegacao entre paginas
  if (event.request.url.includes('/api/') || event.request.mode === 'navigate') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request))
  );
});
