import { supabase } from './supabase';
import { requestFirebaseNotificationPermission } from './firebase';

/**
 * Regista o token FCM para push notifications.
 * Guarda a subscription na tabela push_subscriptions.
 */
export async function subscribeToPush(userId: string): Promise<boolean> {
    try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            throw new Error('Notificações não são suportadas neste navegador.');
        }

        console.log('[Push] A solicitar token FCM para utilizador:', userId);

        // Verificar permissão
        if (Notification.permission === 'denied') {
            throw new Error('Bloqueado: Precisas de permitir as notificações nas definições do teu navegador/telemóvel.');
        }

        const token = await requestFirebaseNotificationPermission();

        if (!token) {
            throw new Error('Não foi possível obter a chave de ligação (Token FCM).');
        }

        console.log('[Push] Token obtido, a guardar no Supabase...');
        const subscriptionJson = { endpoint: token, fcm: true };

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
            console.error('[Push] Erro Supabase:', error);
            throw new Error(`Falha ao guardar na base de dados: ${error.message}`);
        }

        console.log('[Push] Sucesso: Ligação ativa ✅');
        return true;
    } catch (err: any) {
        console.error('[Push] Erro na subscrição:', err);
        // Relançamos o erro para ser capturado pelo alert no Profile.tsx
        throw err;
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
