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

        console.log('[Push] A solicitar token FCM para utilizador:', userId);
        const token = await requestFirebaseNotificationPermission();

        if (!token) {
            console.error('[Push] Falha ao obter Token FCM (permissão negada ou erro técnico).');
            return false;
        }

        console.log('[Push] Token obtido, a guardar na base de dados (Supabase)...');
        // Guardar/actualizar na DB
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
            alert('⚠️ Erro ao registar dispositivo para notificações. Por favor, tente novamente.');
            return false;
        }

        console.log('[Push] Sucesso: Firebase Cloud Messaging Token guardado e ativo.');
        return true;
    } catch (err) {
        console.error('[Push] Erro crítico ao subscrever FCM:', err);
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

export async function sendPushNotification(params: {
    title: string;
    body: string;
    url?: string;
    userId?: string;
}): Promise<{ sent: number; reason?: string }> {
    try {
        const response = await fetch('/api/send-push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
        });
        const data = await response.json();
        return { sent: data.sent ?? 0, reason: data.reason };
    } catch (err) {
        console.error('[Push] Erro ao enviar push:', err);
        return { sent: 0, reason: 'error_occurred' };
    }
}
