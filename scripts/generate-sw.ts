import { writeFileSync } from 'fs';
import path from 'path';
import { config } from 'dotenv';

config({ path: path.join(process.cwd(), '.env.local'), override: true });
config();

const normalizeEnv = (value?: string) => {
  if (!value) return '';

  const trimmed = value.trim().replace(/[\r\n]+/g, '');

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
};

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
  console.error(`[generate-sw] Missing env vars: ${missing.join(', ')}`);
  process.exit(1);
}

const firebaseConfig = {
  apiKey: normalizeEnv(process.env.VITE_FIREBASE_API_KEY),
  authDomain: normalizeEnv(process.env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId: normalizeEnv(process.env.VITE_FIREBASE_PROJECT_ID),
  storageBucket: normalizeEnv(process.env.VITE_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: normalizeEnv(process.env.VITE_FIREBASE_SENDER_ID),
  appId: normalizeEnv(process.env.VITE_FIREBASE_APP_ID),
  measurementId: normalizeEnv(process.env.VITE_FIREBASE_MEASUREMENT_ID),
};

let cacheVersion = `v-${Date.now()}`;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pkg = require('../package.json');
  cacheVersion = `v-${pkg.version || cacheVersion}`;
} catch {
  // ignore
}

const swContent = `// Generated automatically by scripts/generate-sw.ts
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging-compat.js');

const firebaseConfig = ${JSON.stringify(firebaseConfig, null, 4)};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

const CACHE_NAME = 'minsa-prep-${cacheVersion}';
const DATA_CACHE_NAME = 'minsa-prep-data-${cacheVersion}';
const APP_ICON = '/app-icon.png';
const APP_BADGE = '/app-badge.png';

const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/version.json',
  APP_ICON,
  APP_BADGE
];

const buildNotificationTag = (title, body, url, rawTag) => {
  if (rawTag) return rawTag;

  return 'push-' + btoa(unescape(encodeURIComponent([title, body, url].join('|'))))
    .replace(/=/g, '')
    .replace(/[+/]/g, '-')
    .slice(0, 80);
};

const buildNotificationOptions = ({ body, url, clickAction, tag }) => ({
  body,
  icon: APP_ICON,
  badge: APP_BADGE,
  vibrate: [200, 100, 200],
  requireInteraction: false,
  renotify: false,
  tag,
  data: {
    url,
    click_action: clickAction || url,
  },
  actions: [
    { action: 'open', title: 'Abrir App' },
    { action: 'close', title: 'Fechar' }
  ]
});

const recentlyShownTags = new Map();

const showAppNotification = async (title, options) => {
  const tag = options?.tag;
  if (tag) {
    const lastShownAt = recentlyShownTags.get(tag) || 0;
    if (Date.now() - lastShownAt < 15000) {
      return null;
    }

    const existing = await self.registration.getNotifications({ tag });
    if (existing.length > 0) {
      return null;
    }

    recentlyShownTags.set(tag, Date.now());
  }

  return self.registration.showNotification(title, options);
};

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
  const notificationTitle = payload.data?.title || payload.notification?.title || 'MINSA Prep';
  const notificationBody = payload.data?.body || payload.notification?.body || 'Tens uma nova notificacao!';
  const notificationUrl = payload.data?.url || '/dashboard';

  return showAppNotification(
    notificationTitle,
    buildNotificationOptions({
      body: notificationBody,
      url: notificationUrl,
      clickAction: payload.fcmOptions?.link || notificationUrl,
      tag: buildNotificationTag(
        notificationTitle,
        notificationBody,
        notificationUrl,
        payload.data?.tag
      ),
    })
  );
});

self.addEventListener('push', (event) => {
  let data = { title: 'MINSA Prep', body: 'Tens uma nova notificacao!', url: '/dashboard' };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (error) {
      data.body = event.data.text() || data.body;
    }
  }

  event.waitUntil(
    showAppNotification(
      data.title,
      buildNotificationOptions({
        body: data.body,
        url: data.url || '/dashboard',
        clickAction: data.url || '/dashboard',
        tag: buildNotificationTag(
          data.title,
          data.body,
          data.url || '/dashboard',
          data.tag
        ),
      })
    )
  );
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
console.log(`[generate-sw] Service worker written to ${outPath}`);
