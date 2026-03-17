import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const requiredKeys = Object.entries(firebaseConfig)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

if (requiredKeys.length) {
    throw new Error(`[Firebase] Variáveis ausentes: ${requiredKeys.join(', ')}. Configure-as em .env (VITE_FIREBASE_...).`);
}

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

            const token = await getToken(messaging, {
                serviceWorkerRegistration: registration
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
