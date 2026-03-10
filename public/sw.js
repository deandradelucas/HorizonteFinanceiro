// ============================================================
// LEGEND: Este script pertence ao "Horizonte Financeiro"
// LEGEND (PT): Service Worker para funcionalidade PWA (Progressive Web App).
//   - Cacheia assets estaticos para uso offline
//   - Intercepta requisicoes fetch para servir do cache
// ============================================================
const CACHE_NAME = 'horizonte-v5.7';
const ASSETS = [
  '/login.html',
  '/index.html',
  '/dashboard.html',
  '/billing.html',
  '/settings.html',
  '/investments.html',
  '/cnpj.html',
  '/goals.html',
  '/history.html',
  '/transactions.html',
  '/register-item.html',
  '/register-item-pj.html',
  '/style.css',
  '/dashboard-final.css',
  '/history-final.css',
  '/investments-final.css',
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

