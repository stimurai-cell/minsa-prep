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
    if (!messaging) return null;

    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            const token = await getToken(messaging, {
                vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY
            });
            return token;
        }
        return null;
    } catch (error) {
        console.error('An error occurred while retrieving token. ', error);
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
