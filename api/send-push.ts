import type { IncomingMessage, ServerResponse } from 'http';
import { fetchPushSubscriptions, sendPushToSubscriptions } from './_lib/push';

async function readBody(req: IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
        let data = '';
        req.on('data', (chunk) => (data += chunk));
        req.on('end', () => {
            try {
                resolve(JSON.parse(data));
            } catch {
                resolve({});
            }
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
        const subscriptions = await fetchPushSubscriptions(userId);

        if (!subscriptions.length) {
            return send(res, 200, { sent: 0, reason: 'no_subscriptions', message: 'User has no push subscriptions' });
        }

        const result = await sendPushToSubscriptions(subscriptions, { title, body, url });

        return send(res, 200, result);
    } catch (err: any) {
        console.error('[send-push] Error:', err);

        return send(res, 500, {
            error: err.message || 'Erro desconhecido',
            details: {
                code: err.code,
                message: err.message,
            }
        });
    }
}
