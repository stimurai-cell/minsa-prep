const CACHE_NAME = 'minsa-prep-v1.0.5';
const DATA_CACHE_NAME = 'minsa-prep-data-v1';

const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/manifest.json'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME && cacheName !== DATA_CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const { url, method } = request;

    // Caching de Dados da API (GET)
    if (url.includes('supabase.co') || url.includes('/api/')) {
        if (method === 'GET') {
            event.respondWith(
                fetch(request)
                    .then((response) => {
                        const resClone = response.clone();
                        caches.open(DATA_CACHE_NAME).then((cache) => cache.put(url, resClone));
                        return response;
                    })
                    .catch(() => caches.match(url))
            );
            return;
        }
    }

    // Assets Estáticos: Stale-While-Revalidate
    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            const fetchedResponse = fetch(request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const resClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, resClone));
                }
                return networkResponse;
            }).catch(() => null);

            return cachedResponse || fetchedResponse;
        })
    );
});

// Mensagens Push
self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : {
        title: 'MINSA Prep',
        body: 'Continue seus estudos para a aprovação!'
    };

    const options = {
        body: data.body,
        icon: 'https://res.cloudinary.com/dzvusz0u4/image/upload/v1773045071/fgfjriydrec3rytqbodo.png',
        badge: 'https://res.cloudinary.com/dzvusz0u4/image/upload/v1773045071/fgfjriydrec3rytqbodo.png',
        vibrate: [100, 50, 100],
        data: { url: data.url || '/dashboard' }
    };

    event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(clients.openWindow(event.notification.data.url));
});
