import admin from 'firebase-admin';
import { createClient } from '@supabase/supabase-js';
import type { IncomingMessage, ServerResponse } from 'http';

// Usar o service account gerado pelo Firebase
if (!admin.apps.length) {
    const rawKey = process.env.FIREBASE_PRIVATE_KEY || "";
    const cleanKey = rawKey.startsWith('"') && rawKey.endsWith('"')
        ? rawKey.substring(1, rawKey.length - 1)
        : rawKey;

    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: "farmolink-28",
            clientEmail: "firebase-adminsdk-fbsvc@farmolink-28.iam.gserviceaccount.com",
            privateKey: cleanKey.replace(/\\n/g, '\n')
        })
    });
}

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function readBody(req: IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
        let data = '';
        req.on('data', chunk => (data += chunk));
        req.on('end', () => {
            try { resolve(JSON.parse(data)); }
            catch { resolve({}); }
        });
        req.on('error', reject);
    });
}

function send(res: ServerResponse, status: number, body: object) {
    const json = JSON.stringify(body);
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(json);
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
    if (req.method !== 'POST') {
        return send(res, 405, { error: 'Method not allowed' });
    }

    const { title, body, url = '/dashboard', userId } = await readBody(req);

    if (!title || !body) {
        return send(res, 400, { error: 'title and body are required' });
    }

    try {
        // Ao invés da subscription completa, guardaremos o Token FCM no campo 'endpoint' na nova lógica
        let query = supabase.from('push_subscriptions').select('endpoint, user_id');
        if (userId) {
            query = query.eq('user_id', userId);
        }

        const { data: subscriptions, error } = await query;

        if (error) throw error;
        if (!subscriptions || subscriptions.length === 0) {
            return send(res, 200, { sent: 0, reason: 'no_subscriptions', message: 'User has no push subscriptions' });
        }

        // Filtra apenas FCM tokens válidos (geralmente não são URLs, ao contrário das antigas endpoint VAPID)
        const tokens = subscriptions
            .map(sub => sub.endpoint)
            .filter(t => t && !t.startsWith('http'));

        if (tokens.length === 0) {
            return send(res, 200, { sent: 0, reason: 'no_valid_tokens', message: 'No valid FCM tokens found' });
        }

        const message = {
            notification: {
                title: title,
                body: body
            },
            data: {
                url: url
            },
            tokens: tokens,
        };

        const response = await admin.messaging().sendEachForMulticast(message);

        // Limpeza de tokens inválidos
        if (response.failureCount > 0) {
            const failedTokens: string[] = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    failedTokens.push(tokens[idx]);
                }
            });

            if (failedTokens.length > 0) {
                await supabase
                    .from('push_subscriptions')
                    .delete()
                    .in('endpoint', failedTokens);
            }
        }

        return send(res, 200, { sent: response.successCount, total: tokens.length, failures: response.failureCount });
    } catch (err: any) {
        console.error('[send-push FCM] Error:', err);
        return send(res, 500, { error: err.message });
    }
}
