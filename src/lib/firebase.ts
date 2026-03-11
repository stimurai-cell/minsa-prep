import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
    apiKey: "AIzaSyAuwBXj9rJM6o4U9AAUTMhQTsbY_-LcrKI",
    authDomain: "farmolink-28.firebaseapp.com",
    projectId: "farmolink-28",
    storageBucket: "farmolink-28.firebasestorage.app",
    messagingSenderId: "845647802142",
    appId: "1:845647802142:web:47c11bd7fd9ae06be6a30f",
    measurementId: "G-L9SM8DDHCP"
};

const app = initializeApp(firebaseConfig);

// Initialize Firebase Cloud Messaging and get a reference to the service
export const messaging = typeof window !== 'undefined' && 'Notification' in window ? getMessaging(app) : null;

// Função para solicitar permissão e obter o token FCM
export const requestFirebaseNotificationPermission = async () => {
    if (!messaging) {
        console.warn('[Firebase] Messaging não suportado neste ambiente.');
        return null;
    }

    try {
        const permission = await Notification.requestPermission();
        console.log('[Firebase] Permissão de notificação:', permission);

        if (permission === 'granted') {
            console.log('[Firebase] Permissão concedida. A procurar Service Worker principal (/sw.js)...');

            // Usar o Service Worker principal (sw.js) que já é registado no index.html e agora contém o Firebase
            let registration = await navigator.serviceWorker.getRegistration();

            if (!registration) {
                console.log('[Firebase] SW não encontrado, a registar /sw.js...');
                registration = await navigator.serviceWorker.register('/sw.js');
            }

            const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || import.meta.env.VITE_FIREBASE_VAPID_KEY;

            if (!vapidKey) {
                throw new Error('VAPID Key ausente no ambiente');
            }

            const token = await getToken(messaging, {
                vapidKey: vapidKey,
                serviceWorkerRegistration: registration
            });

            if (!token) throw new Error('O Firebase não devolveu nenhum token.');

            console.log('[Firebase] Token FCM obtido com sucesso ✅');
            return token;
        }
        console.warn('[Firebase] Permissão negada pelo utilizador.');
        return null;
    } catch (error) {
        console.error('[Firebase] Erro ao obter token FCM:', error);
        return null;
    }
};

// Listener para mensagens recebidas em foreground (com a app aberta)
export const onMessageListener = () => {
    if (!messaging) return new Promise(() => { });

    return new Promise((resolve) => {
        onMessage(messaging, (payload) => {
            resolve(payload);
        });
    });
};
