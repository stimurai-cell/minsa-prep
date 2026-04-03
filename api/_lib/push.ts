import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type PushSubscriptionRow = {
    endpoint: string;
    user_id?: string | null;
    subscription?: any;
    device_id?: string | null;
    channel?: string | null;
    user_agent?: string | null;
    updated_at?: string | null;
    created_at?: string | null;
};

type PushPayload = {
    title: string;
    body: string;
    url: string;
    tag?: string;
};

type FirebaseAdminLike = {
    apps: any[];
    initializeApp: (options: any) => unknown;
    credential: {
        cert: (config: any) => unknown;
    };
    messaging: () => {
        sendEachForMulticast: (payload: {
            data: { title: string; body: string; url: string; tag: string };
            webpush?: {
                fcmOptions?: {
                    link?: string;
                };
            };
            tokens: string[];
        }) => Promise<{
            successCount: number;
            failureCount: number;
            responses: Array<{ success: boolean }>;
        }>;
    };
};

type WebPushLike = {
    setVapidDetails: (subject: string, publicKey: string, privateKey: string) => void;
    sendNotification: (subscription: any, payload: string) => Promise<unknown>;
};

let supabaseAdmin: SupabaseClient | null = null;
let firebaseAdminModule: FirebaseAdminLike | null = null;
let webPushModule: WebPushLike | null = null;

function normalizeServerEnv(value?: string | null) {
    if (!value) return '';

    const trimmed = value.trim().replace(/[\r\n]+/g, '');

    if (
        (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
        return trimmed.slice(1, -1).trim();
    }

    return trimmed;
}

function normalizePrivateKey(value?: string | null) {
    return normalizeServerEnv(value).replace(/\\n/g, '\n');
}

function getFirebaseConfig() {
    return {
        projectId: normalizeServerEnv(process.env.VITE_FIREBASE_PROJECT_ID) || 'farmolink-28',
        clientEmail: normalizeServerEnv(process.env.FIREBASE_CLIENT_EMAIL) || 'firebase-adminsdk-fbsvc@farmolink-28.iam.gserviceaccount.com',
        privateKey: normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
    };
}

export function getSupabaseAdmin() {
    if (supabaseAdmin) {
        return supabaseAdmin;
    }

    const supabaseUrl = normalizeServerEnv(process.env.VITE_SUPABASE_URL);
    const serviceRoleKey = normalizeServerEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error('Supabase admin env vars are missing.');
    }

    supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    return supabaseAdmin;
}

async function getFirebaseAdmin() {
    if (firebaseAdminModule) {
        return firebaseAdminModule;
    }

    const module = await import('firebase-admin');
    firebaseAdminModule = ((module as any).default || module) as FirebaseAdminLike;
    return firebaseAdminModule;
}

async function getWebPush() {
    if (webPushModule) {
        return webPushModule;
    }

    const module = await import('web-push');
    webPushModule = ((module as any).default || module) as WebPushLike;
    return webPushModule;
}

async function ensureFirebaseAdmin() {
    const firebaseConfig = getFirebaseConfig();

    if (!firebaseConfig.privateKey) {
        return null;
    }

    try {
        const admin = await getFirebaseAdmin();

        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(firebaseConfig),
            });
        }

        return admin;
    } catch (error) {
        console.error('[push] Firebase Admin init error:', error);
        return null;
    }
}

async function ensureWebPush() {
    const subject = normalizeServerEnv(process.env.VAPID_SUBJECT) || 'mailto:admin@minsaprep.ao';
    const publicKey = normalizeServerEnv(process.env.VITE_VAPID_PUBLIC_KEY);
    const privateKey = normalizeServerEnv(process.env.VAPID_PRIVATE_KEY);

    if (!publicKey || !privateKey) {
        return null;
    }

    try {
        const webpush = await getWebPush();
        webpush.setVapidDetails(subject, publicKey, privateKey);
        return webpush;
    } catch (error) {
        console.error('[push] Web Push init error:', error);
        return null;
    }
}

function isFcmToken(row: PushSubscriptionRow) {
    return Boolean(row.endpoint) && !row.endpoint.startsWith('http');
}

function isWebPushSubscription(row: PushSubscriptionRow) {
    return Boolean(
        row.endpoint?.startsWith('http') &&
        row.subscription?.endpoint &&
        row.subscription?.keys?.p256dh &&
        row.subscription?.keys?.auth
    );
}

function getSubscriptionIdentity(row: PushSubscriptionRow) {
    if (row.user_id && row.device_id) {
        return `${row.user_id}:${row.device_id}`;
    }

    return row.endpoint.trim();
}

function getSubscriptionTimestamp(row: PushSubscriptionRow) {
    return new Date(row.updated_at || row.created_at || 0).getTime() || 0;
}

async function cleanupSubscriptions(endpoints: string[]) {
    if (!endpoints.length) return;

    await getSupabaseAdmin()
        .from('push_subscriptions')
        .delete()
        .in('endpoint', endpoints);
}

function buildNotificationTag(payload: PushPayload) {
    if (payload.tag) {
        return payload.tag;
    }

    const rawTag = `${payload.url}|${payload.title}|${payload.body}`;
    return `push-${Buffer.from(rawTag).toString('base64url').slice(0, 80)}`;
}

function preferCurrentSubscriptions(rows: PushSubscriptionRow[]) {
    const validRows = rows.filter((row) => isWebPushSubscription(row) || isFcmToken(row));
    const grouped = new Map<string, PushSubscriptionRow[]>();

    validRows.forEach((row) => {
        const identity = getSubscriptionIdentity(row);
        const bucket = grouped.get(identity) || [];
        bucket.push(row);
        grouped.set(identity, bucket);
    });

    return Array.from(grouped.values()).map((bucket) =>
        bucket
            .slice()
            .sort((left, right) => getSubscriptionTimestamp(right) - getSubscriptionTimestamp(left))[0]
    );
}

export async function fetchPushSubscriptions(userId?: string) {
    let query = getSupabaseAdmin()
        .from('push_subscriptions')
        .select('endpoint, user_id, subscription, device_id, channel, user_agent, updated_at, created_at');

    if (userId) {
        query = query.eq('user_id', userId);
    }

    let { data, error } = await query;

    if (error) {
        const fallbackAllowed =
            String(error.code || '') === '42703' ||
            String(error.code || '') === 'PGRST204' ||
            String(error.message || '').toLowerCase().includes('device_id') ||
            String(error.message || '').toLowerCase().includes('channel') ||
            String(error.message || '').toLowerCase().includes('user_agent') ||
            String(error.message || '').toLowerCase().includes('last_seen_at');

        if (!fallbackAllowed) {
            throw error;
        }

        let fallbackQuery = getSupabaseAdmin()
            .from('push_subscriptions')
            .select('endpoint, user_id, subscription, updated_at, created_at');

        if (userId) {
            fallbackQuery = fallbackQuery.eq('user_id', userId);
        }

        const fallbackResult = await fallbackQuery;
        data = fallbackResult.data;
        error = fallbackResult.error;
    }

    if (error) {
        throw error;
    }

    return (data || []) as PushSubscriptionRow[];
}

export function countRegisteredPushDevices(rows: PushSubscriptionRow[]) {
    return new Set(
        rows
            .filter((row) => isFcmToken(row) || isWebPushSubscription(row))
            .map((row) => getSubscriptionIdentity(row))
    ).size;
}

export async function sendPushToSubscriptions(rows: PushSubscriptionRow[], payload: PushPayload) {
    const preferredRows = preferCurrentSubscriptions(rows);
    const invalidEndpoints: string[] = [];
    let sent = 0;
    let failures = 0;
    const notificationTag = buildNotificationTag(payload);

    const fcmTokens = preferredRows.filter(isFcmToken).map((row) => row.endpoint);
    if (fcmTokens.length) {
        const admin = await ensureFirebaseAdmin();

        if (admin) {
            const response = await admin.messaging().sendEachForMulticast({
                data: {
                    title: payload.title,
                    body: payload.body,
                    url: payload.url,
                    tag: notificationTag,
                },
                webpush: {
                    fcmOptions: {
                        link: payload.url,
                    },
                },
                tokens: fcmTokens,
            });

            sent += response.successCount;
            failures += response.failureCount;

            response.responses.forEach((result, index) => {
                if (!result.success) {
                    invalidEndpoints.push(fcmTokens[index]);
                }
            });
        }
    }

    const webPushRows = preferredRows.filter(isWebPushSubscription);
    if (webPushRows.length) {
        const webpush = await ensureWebPush();

        if (webpush) {
            const results = await Promise.all(
                webPushRows.map(async (row) => {
                    try {
                        await webpush.sendNotification(
                            row.subscription,
                            JSON.stringify({
                                title: payload.title,
                                body: payload.body,
                                url: payload.url,
                                tag: notificationTag,
                            })
                        );

                        return true;
                    } catch (error: any) {
                        const statusCode = Number(error?.statusCode || 0);
                        if (statusCode === 403 || statusCode === 404 || statusCode === 410) {
                            invalidEndpoints.push(row.endpoint);
                        }
                        console.error('[push] Web Push error:', error);
                        return false;
                    }
                })
            );

            sent += results.filter(Boolean).length;
            failures += results.filter((result) => !result).length;
        }
    }

    if (invalidEndpoints.length > 0) {
        await cleanupSubscriptions([...new Set(invalidEndpoints)]);
    }

    return {
        sent,
        failures,
        total: fcmTokens.length + webPushRows.length,
    };
}
