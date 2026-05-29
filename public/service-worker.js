// PWA Service Worker (desarrollo vs producción)
// En DESARROLLO: no cachea (reload siempre trae lo nuevo)
// En PRODUCCIÓN: cachea para offline/velocidad

const IS_DEVELOPMENT = true; // Cambiar a false para producción
const CACHE_NAME = IS_DEVELOPMENT ? 'regomax-dev' : 'regomax-despachos-v2';

const PRECACHE_URLS = IS_DEVELOPMENT ? [] : [
    '/',
    '/login.html',
    '/manifest.json',
    '/service-worker.js'
];

self.addEventListener('install', (event) => {
    if (IS_DEVELOPMENT) {
        // En desarrollo, no precacheamos nada
        self.skipWaiting();
        return;
    }

    event.waitUntil(
        (async () => {
            const cache = await caches.open(CACHE_NAME);
            await cache.addAll(PRECACHE_URLS);
            await self.skipWaiting();
        })()
    );
});

self.addEventListener('activate', (event) => {
    if (IS_DEVELOPMENT) {
        // En desarrollo, limpiamos TODO el cache
        event.waitUntil(
            (async () => {
                const keys = await caches.keys();
                await Promise.all(keys.map((k) => caches.delete(k)));
                await self.clients.claim();
            })()
        );
        return;
    }

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

    // En desarrollo: todo network-first (sin cache)
    if (IS_DEVELOPMENT) {
        event.respondWith(
            fetch(req)
                .then((res) => res)
                .catch(() => caches.match(req))
        );
        return;
    }

    // Solo trabajamos con mismos origen.
    if (url.origin !== self.location.origin) return;

    // Navegaciones (HTML): network-first con fallback a cache.
    if (req.mode === 'navigate') {
        event.respondWith(
            (async () => {
                try {
                    const fresh = await fetch(req);
                    const cache = await caches.open(CACHE_NAME);
                    cache.put(req, fresh.clone());
                    return fresh;
                } catch {
                    const cached = await caches.match(req);
                    return cached || caches.match('/login.html');
                }
            })()
        );
        return;
    }

    // Recursos estáticos: cache-first.
    const isStatic =
        url.pathname.startsWith('/assets/') ||
        url.pathname.endsWith('.css') ||
        url.pathname.endsWith('.js') ||
        url.pathname.endsWith('.png') ||
        url.pathname.endsWith('.jpg') ||
        url.pathname.endsWith('.jpeg') ||
        url.pathname.endsWith('.svg') ||
        url.pathname.endsWith('.ico') ||
        url.pathname.endsWith('.webp');

    if (isStatic) {
        event.respondWith(
            (async () => {
                const cached = await caches.match(req);
                if (cached) return cached;
                const fresh = await fetch(req);
                const cache = await caches.open(CACHE_NAME);
                cache.put(req, fresh.clone());
                return fresh;
            })()
        );
    }
});