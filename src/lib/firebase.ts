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
            console.log('[Firebase] Permissão concedida. A aguardar Service Worker principal (/sw.js)...');

            // Garantir que o Service Worker está pronto antes de continuar (evita hang/timeout)
            const registration = await navigator.serviceWorker.ready;

            if (!registration) {
                throw new Error('O motor da App (Service Worker) não está pronto ou falhou.');
            }

            const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || import.meta.env.VITE_FIREBASE_VAPID_KEY;

            if (!vapidKey) {
                throw new Error('Chave de segurança (VAPID) não encontrada no ambiente.');
            }

            console.log('[Firebase] A obter token com VAPID Key...');
            const token = await getToken(messaging, {
                vapidKey: vapidKey,
                serviceWorkerRegistration: registration
            });

            if (!token) throw new Error('O Firebase não devolveu um token de ligação.');

            console.log('[Firebase] Token FCM obtido com sucesso ✅');
            return token;
        }
        throw new Error('Permissão Negada: Tens de permitir as notificações no navegador.');
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
