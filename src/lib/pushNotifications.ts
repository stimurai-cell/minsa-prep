import { supabase } from './supabase';
import { normalizeRuntimeEnv } from './env';

const DEFAULT_VAPID_PUBLIC_KEY = 'BGQ5wyLfdc49MZNRC_yp7C0PRiH4X9RStURZKZRUA8YZg2BbTz0aal-2TfQjhWV_OCVp9dLHBfIkreUIIv0COrM';

function resolveVapidPublicKey() {
    return (
        normalizeRuntimeEnv(import.meta.env.VITE_VAPID_PUBLIC_KEY) ||
        normalizeRuntimeEnv(import.meta.env.VITE_FIREBASE_VAPID_KEY) ||
        DEFAULT_VAPID_PUBLIC_KEY
    );
}

function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);

    return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

function getFriendlyPushError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error || '');
    const normalized = message.toLowerCase();

    if (normalized.includes('permission')) {
        return 'As notificações estão bloqueadas neste aparelho. Ative-as nas definições do navegador e tente de novo.';
    }

    if (normalized.includes('pushmanager') || normalized.includes('applicationserverkey')) {
        return 'Não foi possível preparar as notificações neste aparelho. Atualize a página e tente novamente.';
    }

    if (normalized.includes('service worker')) {
        return 'O aplicativo ainda está a terminar a preparação. Aguarde alguns segundos e tente novamente.';
    }

    return 'Não foi possível ativar as notificações agora. Tente novamente em instantes.';
}

async function getPushSubscription(registration: ServiceWorkerRegistration) {
    const existingSubscription = await registration.pushManager.getSubscription();
    const vapidPublicKey = resolveVapidPublicKey();

    if (existingSubscription) {
        try {
            // Renew the browser subscription so stale VAPID-linked endpoints do not linger.
            await existingSubscription.unsubscribe();
        } catch (error) {
            console.warn('[Push] Nao foi possivel renovar a subscricao existente, mantendo a atual.', error);
            return existingSubscription;
        }
    }

    return registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
}

/**
 * Regista uma subscription Web Push padrão e guarda-a no Supabase.
 */
export async function subscribeToPush(userId: string): Promise<boolean> {
    try {
        console.log(`[Push] Iniciando subscrição para usuário: ${userId}`);

        if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
            throw new Error('PushManager não suportado');
        }

        let permission = Notification.permission;
        if (permission === 'default') {
            permission = await Notification.requestPermission();
        }

        if (permission !== 'granted') {
            throw new Error('Notification permission denied');
        }

        const registration = await navigator.serviceWorker.ready;
        if (!registration) {
            throw new Error('Service worker not ready');
        }

        const subscription = await getPushSubscription(registration);
        const subscriptionJson = subscription.toJSON();

        if (!subscription.endpoint || !subscriptionJson.keys?.p256dh || !subscriptionJson.keys?.auth) {
            throw new Error('Invalid push subscription');
        }

        const { error, data } = await supabase
            .from('push_subscriptions')
            .upsert(
                {
                    user_id: userId,
                    endpoint: subscription.endpoint,
                    subscription: {
                        ...subscriptionJson,
                        provider: 'webpush',
                    },
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'user_id,endpoint' }
            )
            .select()
            .single();

        if (error) {
            console.error('[Push] Erro Supabase:', error);
            throw new Error(`Supabase: ${error.message}`);
        }

        const { error: cleanupError } = await supabase
            .from('push_subscriptions')
            .delete()
            .eq('user_id', userId)
            .neq('endpoint', subscription.endpoint)
            .not('endpoint', 'ilike', 'http%');

        if (cleanupError) {
            console.warn('[Push] Falha ao limpar tokens antigos:', cleanupError);
        }

        console.log('[Push] Subscrição Web Push ativa ✅', data);
        return true;
    } catch (error) {
        console.error('[Push] Erro na subscrição:', error);
        throw new Error(getFriendlyPushError(error));
    }
}

/**
 * Pede permissão e ativa o push, se possível.
 */
export async function requestNotificationPermission(userId: string): Promise<NotificationPermission> {
    if (!('Notification' in window)) return 'denied';

    let permission = Notification.permission;

    if (permission === 'default') {
        permission = await Notification.requestPermission();
    }

    if (permission === 'granted') {
        try {
            await subscribeToPush(userId);
        } catch (error) {
            console.error('[Push] Falha ao ativar notificações:', error);
        }
    }

    return permission;
}

export async function syncPushSubscriptionIfGranted(userId: string): Promise<boolean> {
    if (!userId || !('Notification' in window) || Notification.permission !== 'granted') {
        return false;
    }

    try {
        return await subscribeToPush(userId);
    } catch (error) {
        console.error('[Push] Falha ao sincronizar a subscricao ativa:', error);
        return false;
    }
}

export async function sendPushNotification(params: {
    title: string;
    body: string;
    url?: string;
    userId?: string;
    tag?: string;
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
