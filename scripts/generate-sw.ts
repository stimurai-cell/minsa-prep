import { writeFileSync } from 'fs';
import path from 'path';
import { config } from 'dotenv';

// Carrega .env.local se existir, depois .env padrão
config({ path: path.join(process.cwd(), '.env.local'), override: true });
config();

const requiredEnv = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
  'VITE_FIREBASE_MEASUREMENT_ID',
];

const missing = requiredEnv.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`[generate-sw] Faltam variáveis: ${missing.join(', ')}`);
  process.exit(1);
}

const cfg = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Version string para cache bust. Usa package.json version se existir; senão timestamp.
let cacheVersion = `v-${Date.now()}`;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pkg = require('../package.json');
  cacheVersion = `v-${pkg.version || cacheVersion}`;
} catch {
  // ignore
}

const swContent = `// Gerado automaticamente por scripts/generate-sw.ts
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging-compat.js');

const firebaseConfig = ${JSON.stringify(cfg, null, 4)};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

const CACHE_NAME = 'minsa-prep-${cacheVersion}';
const DATA_CACHE_NAME = 'minsa-prep-data-${cacheVersion}';

const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/version.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => Promise.all(
      cacheNames.map((cacheName) => {
        if (cacheName !== CACHE_NAME && cacheName !== DATA_CACHE_NAME) {
          return caches.delete(cacheName);
        }
        return null;
      })
    )).then(async () => {
      await self.clients.claim();
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      clients.forEach((client) => client.postMessage({ type: 'SW_UPDATED' }));
    })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const { url, method } = request;

  if (url.includes('realtime') || url.includes('supabase.co/realtime')) {
    return;
  }

  const isNavigation = request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html');
  if (isNavigation) {
    event.respondWith(
      fetch('/index.html', { cache: 'no-store' })
        .then((response) => {
          const resClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', resClone));
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  if ((url.includes('supabase.co') || url.includes('/api/')) && method === 'GET') {
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

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && request.method === 'GET') {
            const resClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, resClone));
          }
          return networkResponse;
        })
        .catch(() => null);
    })
  );
});

messaging.onBackgroundMessage((payload) => {
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

self.addEventListener('push', (event) => {
  let data = { title: 'MINSA Prep', body: 'Tens uma nova notificação!', url: '/dashboard' };

  if (event.data) {
    try { data = { ...data, ...event.data.json() }; }
    catch (e) { data.body = event.data.text() || data.body; }
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

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'close') return;

  const urlToOpen = event.notification.data?.click_action || event.notification.data?.url || '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) client.navigate(urlToOpen);
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(urlToOpen);
      return null;
    })
  );
});
`;

const outPath = path.join(process.cwd(), 'public', 'sw.js');
writeFileSync(outPath, swContent, { encoding: 'utf8' });
console.log(`[generate-sw] Service worker escrito em ${outPath}`);
