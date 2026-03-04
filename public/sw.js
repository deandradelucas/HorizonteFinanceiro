// ============================================================
// LEGEND: Este script pertence ao "Horizonte Financeiro"
// LEGEND (PT): Service Worker para funcionalidade PWA (Progressive Web App).
//   - Cacheia assets estáticos para uso offline
//   - Intercepta requisições fetch para servir do cache
// ============================================================
const CACHE_NAME = 'horizonte-v1';
const ASSETS = [
  '/',
  '/login.html',
  '/index.html',
  '/style.css',
  '/script.js'
];

// Evento de instalação: abre o cache e adiciona os arquivos iniciais
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request))
  );
});