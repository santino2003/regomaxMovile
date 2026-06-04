// PWA Service Worker - PRODUCCIÓN SIN CACHE
// Trae siempre lo nuevo del servidor, cachea solo como fallback offline
// Cambios en JS se verán inmediatamente sin reinstalar

const IS_DEVELOPMENT = false;
const CACHE_NAME = 'regomax-despachos-v3';

const PRECACHE_URLS = [
    '/login.html'  // Solo precacheamos la página de login
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        (async () => {
            const cache = await caches.open(CACHE_NAME);
            try {
                await cache.addAll(PRECACHE_URLS);
            } catch (err) {
                console.warn('Error precaching:', err);
            }
            await self.skipWaiting();
        })()
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        (async () => {
            const keys = await caches.keys();
            await Promise.all(
                keys
                    .filter((k) => k !== CACHE_NAME)
                    .map((k) => caches.delete(k))
            );
            await self.clients.claim();
        })()
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    const url = new URL(req.url);

    // Solo trabajamos con mismo origen
    if (url.origin !== self.location.origin) return;

    // ESTRATEGIA: Network-first siempre (trae lo nuevo primero)
    event.respondWith(
        (async () => {
            try {
                // Intentar traer del servidor (lo nuevo)
                const fresh = await fetch(req);
                
                // Cachear como fallback offline
                if (req.method === 'GET') {
                    const cache = await caches.open(CACHE_NAME);
                    cache.put(req, fresh.clone());
                }
                
                return fresh;
            } catch (err) {
                // Si no hay conexión, usar cache como fallback
                const cached = await caches.match(req);
                if (cached) return cached;
                
                // Fallback final
                if (req.mode === 'navigate') {
                    return caches.match('/login.html');
                }
                
                throw err;
            }
        })()
    );
});