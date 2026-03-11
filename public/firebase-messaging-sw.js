importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging-compat.js');

const firebaseConfig = {
    apiKey: "AIzaSyAuwBXj9rJM6o4U9AAUTMhQTsbY_-LcrKI",
    authDomain: "farmolink-28.firebaseapp.com",
    projectId: "farmolink-28",
    storageBucket: "farmolink-28.firebasestorage.app",
    messagingSenderId: "845647802142",
    appId: "1:845647802142:web:47c11bd7fd9ae06be6a30f",
    measurementId: "G-L9SM8DDHCP"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);

    const notificationTitle = payload.notification?.title || payload.data?.title || 'MINSA Prep';
    const notificationOptions = {
        body: payload.notification?.body || payload.data?.body || 'Nova notificação!',
        icon: 'https://res.cloudinary.com/dzvusz0u4/image/upload/v1773051625/qosfbrnflucygej3us4h.png',
        badge: 'https://res.cloudinary.com/dzvusz0u4/image/upload/v1773051625/qosfbrnflucygej3us4h.png',
        data: { url: payload.data?.url || '/dashboard' }
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

// Outros eventos do service worker original mantêm-se em sw.js
