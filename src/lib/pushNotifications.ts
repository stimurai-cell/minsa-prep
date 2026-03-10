import { supabase } from './supabase';

// VAPID public key do .env
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const buffer = new ArrayBuffer(rawData.length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < rawData.length; ++i) {
        view[i] = rawData.charCodeAt(i);
    }
    return buffer;
}

/**
 * Regista o service worker e subscreve para push notifications.
 * Guarda a subscription na tabela push_subscriptions.
 */
export async function subscribeToPush(userId: string): Promise<boolean> {
    try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.warn('[Push] Service Worker ou PushManager não suportado.');
            return false;
        }

        if (!VAPID_PUBLIC_KEY) {
            console.warn('[Push] VITE_VAPID_PUBLIC_KEY não configurado.');
            return false;
        }

        const registration = await navigator.serviceWorker.ready;

        // Verificar se já existe uma subscription activa
        const existingSubscription = await registration.pushManager.getSubscription();

        let subscription = existingSubscription;

        if (!subscription) {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
            });
        }

        // Guardar/actualizar na DB
        const subscriptionJson = subscription.toJSON();

        const { error } = await supabase
            .from('push_subscriptions')
            .upsert(
                {
                    user_id: userId,
                    subscription: subscriptionJson,
                    endpoint: subscriptionJson.endpoint,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'user_id,endpoint' }
            );

        if (error) {
            console.error('[Push] Erro ao guardar subscription:', error);
            return false;
        }

        console.log('[Push] Subscription guardada com sucesso.');
        return true;
    } catch (err) {
        console.error('[Push] Erro ao subscrever:', err);
        return false;
    }
}

/**
 * Pede permissão de notificações e subscreve para push se aceite.
 */
export async function requestNotificationPermission(userId: string): Promise<NotificationPermission> {
    if (!('Notification' in window)) return 'denied';

    let permission = Notification.permission;

    if (permission === 'default') {
        permission = await Notification.requestPermission();
    }

    if (permission === 'granted') {
        await subscribeToPush(userId);
    }

    return permission;
}

/**
 * Envia uma push notification via API backend.
 */
export async function sendPushNotification(params: {
    title: string;
    body: string;
    url?: string;
    userId?: string;
}): Promise<void> {
    try {
        await fetch('/api/send-push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
        });
    } catch (err) {
        console.error('[Push] Erro ao enviar push:', err);
    }
}
