import { fetchPushSubscriptions, sendPushToSubscriptions } from './_lib/push.js';

async function parseBody(req: any) {
    if (req.body && typeof req.body === 'object') {
        return req.body;
    }

    if (typeof req.body === 'string') {
        try {
            return JSON.parse(req.body);
        } catch {
            return {};
        }
    }

    if (typeof req.on !== 'function') {
        return {};
    }

    return await new Promise<Record<string, any>>((resolve, reject) => {
        let data = '';

        req.on('data', (chunk: Buffer | string) => {
            data += chunk.toString();
        });

        req.on('end', () => {
            if (!data) {
                resolve({});
                return;
            }

            try {
                resolve(JSON.parse(data));
            } catch {
                resolve({});
            }
        });

        req.on('error', reject);
    });
}

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { title, body, url = '/dashboard', userId, tag } = await parseBody(req);

    if (!title || !body) {
        return res.status(400).json({ error: 'title and body are required' });
    }

    try {
        const subscriptions = await fetchPushSubscriptions(userId);

        if (!subscriptions.length) {
            return res.status(200).json({
                sent: 0,
                reason: 'no_subscriptions',
                message: 'User has no push subscriptions',
            });
        }

        const result = await sendPushToSubscriptions(subscriptions, { title, body, url, tag });
        return res.status(200).json(result);
    } catch (err: any) {
        console.error('[send-push] Error:', err);

        return res.status(500).json({
            error: err.message || 'Erro desconhecido',
            details: {
                code: err.code,
                message: err.message,
            },
        });
    }
}
