const CACHE_NAME = 'minsa-prep-v1.0.3';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/manifest.json'
];

self.addEventListener('install', (event) => {
    // Força o SW a saltar a espera e ativar imediatamente
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

self.addEventListener('activate', (event) => {
    // Remove caches antigos
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim()) // Assume controle das abas abertas imediatamente
    );
});

self.addEventListener('fetch', (event) => {
    // Estratégia: Network First para garantir que pegamos sempre a versão mais recente
    event.respondWith(
        fetch(event.request).catch(() => {
            return caches.match(event.request);
        })
    );
});

// Suporte a Notificações Push
self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : {
        title: 'MINSA Prep',
        body: 'Nova atualização disponível para você!'
    };

    const options = {
        body: data.body,
        icon: 'https://res.cloudinary.com/dzvusz0u4/image/upload/v1773045071/fgfjriydrec3rytqbodo.png',
        badge: 'https://res.cloudinary.com/dzvusz0u4/image/upload/v1773045071/fgfjriydrec3rytqbodo.png',
        vibrate: [100, 50, 100],
        data: {
            url: data.url || '/dashboard'
        }
    };

    event.waitUntil(
        self.notification.showNotification(data.title, options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data.url)
    );
});
