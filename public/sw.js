// Firebase Cloud Messaging Service Worker
// Importa o Firebase SDK para service workers
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging-compat.js');

// Configuração Firebase (deve coincidir com a do frontend)
const firebaseConfig = {
    apiKey: "AIzaSyAuwBXj9rJM6o4U9AAUTMhQTsbY_-LcrKI",
    authDomain: "farmolink-28.firebaseapp.com",
    projectId: "farmolink-28",
    storageBucket: "farmolink-28.firebasestorage.app",
    messagingSenderId: "845647802142",
    appId: "1:845647802142:web:47c11bd7fd9ae06be6a30f",
    measurementId: "G-L9SM8DDHCP"
};

// Inicializa Firebase
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

const CACHE_NAME = 'minsa-prep-v1.0.7';
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

    // Não interceptar requests push/notificações do supabase realtime
    if (url.includes('realtime') || url.includes('supabase.co/realtime')) {
        return;
    }

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
            if (cachedResponse) {
                return cachedResponse;
            }
            
            return fetch(request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const resClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        return cache.put(request, resClone);
                    });
                }
                return networkResponse;
            }).catch(() => null);
        })
    );
});

// ─── Firebase Cloud Messaging ──────────────────────────────────────────────────────

// Background message handler - Recebe mensagens quando app está em 2º plano
messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Mensagem recebida em background:', payload);

    const notificationTitle = payload.notification?.title || 'MINSA Prep';
    const notificationOptions = {
        body: payload.notification?.body || 'Tens uma nova notificação!',
        icon: 'https://res.cloudinary.com/dzvusz0u4/image/upload/v1773051625/qosfbrnflucygej3us4h.png',
        badge: 'https://res.cloudinary.com/dzvusz0u4/image/upload/v1773051625/qosfbrnflucygej3us4h.png',
        vibrate: [200, 100, 200],
        requireInteraction: false,
        data: { 
            url: payload.data?.url || '/dashboard',
            click_action: payload.fcmOptions?.link || '/dashboard'
        },
        actions: [
            { action: 'open', title: 'Abrir App' },
            { action: 'close', title: 'Fechar' }
        ]
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Push event handler - Compatibilidade com browsers mais antigos
self.addEventListener('push', (event) => {
    let data = { title: 'MINSA Prep', body: 'Tens uma nova notificação!', url: '/dashboard' };

    if (event.data) {
        try { 
            data = { ...data, ...event.data.json() }; 
        } catch (e) { 
            data.body = event.data.text() || data.body; 
        }
    }

    const options = {
        body: data.body,
        icon: 'https://res.cloudinary.com/dzvusz0u4/image/upload/v1773051625/qosfbrnflucygej3us4h.png',
        badge: 'https://res.cloudinary.com/dzvusz0u4/image/upload/v1773051625/qosfbrnflucygej3us4h.png',
        vibrate: [200, 100, 200],
        requireInteraction: false,
        data: { url: data.url || '/dashboard' },
        actions: [
            { action: 'open', title: 'Abrir App' },
            { action: 'close', title: 'Fechar' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notificação clicada:', event);
    event.notification.close();

    if (event.action === 'close') return;

    // Prioriza o URL do data.click_action (FCM) ou data.url (fallback)
    const urlToOpen = event.notification.data?.click_action || event.notification.data?.url || '/dashboard';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Se o app já está aberto, focar nele e navegar
            for (const client of clientList) {
                if ('focus' in client) {
                    client.focus();
                    if ('navigate' in client) client.navigate(urlToOpen);
                    return;
                }
            }
            // Senão abrir nova janela
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});
