import { supabase } from './supabase';
import { requestFirebaseNotificationPermission } from './firebase';

/**
 * Regista o token FCM para push notifications.
 * Guarda a subscription na tabela push_subscriptions.
 */
export async function subscribeToPush(userId: string): Promise<boolean> {
    try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.warn('[Push] Service Worker ou PushManager não suportado.');
            return false;
        }

        const token = await requestFirebaseNotificationPermission();

        if (!token) {
            console.warn('[Push] Falha ao obter Token FCM.');
            return false;
        }

        // Guardar/actualizar na DB
        // Usamos um formato compatível para a coluna subscription, mas focamo-nos em guardar o FCM token no endpoint
        const subscriptionJson = {
            endpoint: token,
            fcm: true
        };

        const { error } = await supabase
            .from('push_subscriptions')
            .upsert(
                {
                    user_id: userId,
                    subscription: subscriptionJson,
                    endpoint: token,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'user_id,endpoint' }
            );

        if (error) {
            console.error('[Push] Erro ao guardar token FCM na BD:', error);
            return false;
        }

        console.log('[Push] Firebase Cloud Messaging Token guardado com sucesso.');
        return true;
    } catch (err) {
        console.error('[Push] Erro ao subscrever FCM:', err);
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
