import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type PushSubscriptionRow = {
    endpoint: string;
    user_id?: string | null;
    subscription?: any;
};

type PushPayload = {
    title: string;
    body: string;
    url: string;
};

type FirebaseAdminLike = {
    apps: any[];
    initializeApp: (options: any) => unknown;
    credential: {
        cert: (config: any) => unknown;
    };
    messaging: () => {
        sendEachForMulticast: (payload: {
            notification: { title: string; body: string };
            data: { url: string };
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

async function cleanupSubscriptions(endpoints: string[]) {
    if (!endpoints.length) return;

    await getSupabaseAdmin()
        .from('push_subscriptions')
        .delete()
        .in('endpoint', endpoints);
}

export async function fetchPushSubscriptions(userId?: string) {
    let query = getSupabaseAdmin()
        .from('push_subscriptions')
        .select('endpoint, user_id, subscription');

    if (userId) {
        query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) {
        throw error;
    }

    return (data || []) as PushSubscriptionRow[];
}

export function countRegisteredPushDevices(rows: PushSubscriptionRow[]) {
    return new Set(
        rows
            .filter((row) => isFcmToken(row) || isWebPushSubscription(row))
            .map((row) => row.endpoint.trim())
    ).size;
}

export async function sendPushToSubscriptions(rows: PushSubscriptionRow[], payload: PushPayload) {
    const invalidEndpoints: string[] = [];
    let sent = 0;
    let failures = 0;

    const fcmTokens = rows.filter(isFcmToken).map((row) => row.endpoint);
    if (fcmTokens.length) {
        const admin = await ensureFirebaseAdmin();

        if (admin) {
            const response = await admin.messaging().sendEachForMulticast({
                notification: {
                    title: payload.title,
                    body: payload.body,
                },
                data: {
                    url: payload.url,
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

    const webPushRows = rows.filter(isWebPushSubscription);
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
                            })
                        );

                        return true;
                    } catch (error: any) {
                        const statusCode = Number(error?.statusCode || 0);
                        if (statusCode === 404 || statusCode === 410) {
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
