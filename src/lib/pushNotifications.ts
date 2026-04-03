import { supabase } from './supabase';
import { normalizeRuntimeEnv } from './env';

const DEFAULT_VAPID_PUBLIC_KEY = 'BGQ5wyLfdc49MZNRC_yp7C0PRiH4X9RStURZKZRUA8YZg2BbTz0aal-2TfQjhWV_OCVp9dLHBfIkreUIIv0COrM';
const DEVICE_ID_STORAGE_KEY = 'minsa-prep-push-device-id';

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

function getDeviceId() {
    let currentId = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (currentId) return currentId;

    currentId = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, currentId);
    return currentId;
}

function getFriendlyPushError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error || '');
    const normalized = message.toLowerCase();

    if (normalized.includes('permission')) {
        return 'As notificacoes estao bloqueadas neste aparelho. Ative-as nas definicoes do navegador e tente de novo.';
    }

    if (normalized.includes('pushmanager') || normalized.includes('applicationserverkey')) {
        return 'Nao foi possivel preparar as notificacoes neste aparelho. Atualize a pagina e tente novamente.';
    }

    if (normalized.includes('service worker')) {
        return 'O aplicativo ainda esta a terminar a preparacao. Aguarde alguns segundos e tente novamente.';
    }

    return 'Nao foi possivel ativar as notificacoes agora. Tente novamente em instantes.';
}

async function getPushSubscription(registration: ServiceWorkerRegistration) {
    const existingSubscription = await registration.pushManager.getSubscription();
    if (existingSubscription) {
        return existingSubscription;
    }

    const vapidPublicKey = resolveVapidPublicKey();
    return registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
}

export async function subscribeToPush(userId: string): Promise<boolean> {
    try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
            throw new Error('PushManager nao suportado');
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
        const deviceId = getDeviceId();

        if (!subscription.endpoint || !subscriptionJson.keys?.p256dh || !subscriptionJson.keys?.auth) {
            throw new Error('Invalid push subscription');
        }

        const { error } = await supabase
            .from('push_subscriptions')
            .upsert(
                {
                    user_id: userId,
                    device_id: deviceId,
                    channel: 'webpush',
                    user_agent: navigator.userAgent || null,
                    endpoint: subscription.endpoint,
                    subscription: {
                        ...subscriptionJson,
                        provider: 'webpush',
                    },
                    updated_at: new Date().toISOString(),
                    last_seen_at: new Date().toISOString(),
                },
                { onConflict: 'user_id,device_id' }
            );

        if (error) {
            const fallbackAllowed =
                String(error.code || '') === 'PGRST204' ||
                String(error.code || '') === '42703' ||
                String(error.message || '').toLowerCase().includes('device_id') ||
                String(error.message || '').toLowerCase().includes('channel') ||
                String(error.message || '').toLowerCase().includes('last_seen_at');

            if (!fallbackAllowed) {
                throw new Error(`Supabase: ${error.message}`);
            }

            const fallbackInsert = await supabase
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
                );

            if (fallbackInsert.error) {
                throw new Error(`Supabase: ${fallbackInsert.error.message}`);
            }
        }

        return true;
    } catch (error) {
        console.error('[Push] Erro na subscricao:', error);
        throw new Error(getFriendlyPushError(error));
    }
}

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
            console.error('[Push] Falha ao ativar notificacoes:', error);
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

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || `push_request_failed_${response.status}`);
        }

        const data = await response.json();
        return { sent: data.sent ?? 0, reason: data.reason };
    } catch (err) {
        console.error('[Push] Erro ao enviar push:', err);
        return { sent: 0, reason: 'error_occurred' };
    }
}
