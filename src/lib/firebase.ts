import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { normalizeRuntimeEnv } from "./env";

const firebaseConfig = {
    apiKey: normalizeRuntimeEnv(import.meta.env.VITE_FIREBASE_API_KEY),
    authDomain: normalizeRuntimeEnv(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
    projectId: normalizeRuntimeEnv(import.meta.env.VITE_FIREBASE_PROJECT_ID),
    storageBucket: normalizeRuntimeEnv(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
    messagingSenderId: normalizeRuntimeEnv(import.meta.env.VITE_FIREBASE_SENDER_ID),
    appId: normalizeRuntimeEnv(import.meta.env.VITE_FIREBASE_APP_ID),
    measurementId: normalizeRuntimeEnv(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID)
};

const requiredKeys = Object.entries(firebaseConfig)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

if (requiredKeys.length) {
    throw new Error(`[Firebase] Variáveis ausentes: ${requiredKeys.join(', ')}. Configure-as em .env (VITE_FIREBASE_...).`);
}

const DEFAULT_VAPID_KEY = 'BGQ5wyLfdc49MZNRC_yp7C0PRiH4X9RStURZKZRUA8YZg2BbTz0aal-2TfQjhWV_OCVp9dLHBfIkreUIIv0COrM';

const app = initializeApp(firebaseConfig as any);

// Initialize Firebase Cloud Messaging and get a reference to the service
export const messaging = typeof window !== 'undefined' && 'Notification' in window ? getMessaging(app) : null;

// Função para solicitar permissão e obter o token FCM
export const requestFirebaseNotificationPermission = async () => {
    if (!messaging) {
        console.warn('[Firebase] Messaging não suportado neste ambiente.');
        return null;
    }

    try {
        console.log('[Firebase] Solicitando permissão de notificação...');
        const permission = await Notification.requestPermission();
        console.log('[Firebase] Permissão de notificação:', permission);

        if (permission === 'granted') {
            console.log('[Firebase] Permissão concedida. A aguardar Service Worker principal (/sw.js)...');

            // Garantir que o Service Worker está pronto antes de continuar (evita hang/timeout)
            const registration = await navigator.serviceWorker.ready;

            if (!registration) {
                throw new Error('O motor da App (Service Worker) não está pronto ou falhou ao registar.');
            }

            console.log('[Firebase] A obter token FCM...');

            const vapidKey = normalizeRuntimeEnv(import.meta.env.VITE_FIREBASE_VAPID_KEY) || DEFAULT_VAPID_KEY;
            if (!normalizeRuntimeEnv(import.meta.env.VITE_FIREBASE_VAPID_KEY)) {
                console.warn('[Firebase] VAPID key ausente em env; usando fallback embedado.');
            }
            const token = await getToken(messaging, {
                serviceWorkerRegistration: registration,
                ...(vapidKey ? { vapidKey } : {})
            });

            if (!token) {
                throw new Error('O Firebase não devolveu um token de ligação. Verifica a consola da Firebase.');
            }

            console.log('[Firebase] Token FCM obtido com sucesso ✅');
            return token;
        }

        if (permission === 'denied') {
            throw new Error('Permissão Negada: Bloqueaste as notificações. Por favor, ativa-as nas definições do navegador.');
        }

        throw new Error('Permissão não decidida: Precisas de aceitar o pedido de notificações.');
    } catch (error: any) {
        console.error('[Firebase] Erro crítico ao obter token FCM:', error);
        // Lançamos o erro para ser capturado pela UI
        throw new Error(error.message || 'Erro desconhecido ao ligar ao serviço de notificações.');
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
