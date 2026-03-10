import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';
import type { IncomingMessage, ServerResponse } from 'http';

webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@minsaprep.ao',
    (process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY)!,
    process.env.VAPID_PRIVATE_KEY!
);

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
        let query = supabase.from('push_subscriptions').select('subscription, user_id');
        if (userId) {
            query = query.eq('user_id', userId);
        }

        const { data: subscriptions, error } = await query;

        if (error) throw error;
        if (!subscriptions || subscriptions.length === 0) {
            return send(res, 200, { sent: 0, message: 'No subscriptions found' });
        }

        const payload = JSON.stringify({ title, body, url });

        const results = await Promise.allSettled(
            subscriptions.map(async ({ subscription, user_id }) => {
                try {
                    await webpush.sendNotification(subscription, payload);
                    return { success: true, user_id };
                } catch (err: any) {
                    // 410/404 = subscription expirada => remover da DB
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        await supabase
                            .from('push_subscriptions')
                            .delete()
                            .eq('user_id', user_id)
                            .eq('endpoint', subscription.endpoint);
                    }
                    return { success: false, user_id, error: err.message };
                }
            })
        );

        const sent = results.filter(r => r.status === 'fulfilled' && (r.value as any).success).length;

        return send(res, 200, { sent, total: subscriptions.length });
    } catch (err: any) {
        console.error('[send-push] Error:', err);
        return send(res, 500, { error: err.message });
    }
}
