import { fetchPushSubscriptions, sendPushToSubscriptions } from './_lib/push.js';

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { title, body, url = '/dashboard', userId } = req.body || {};

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

        const result = await sendPushToSubscriptions(subscriptions, { title, body, url });
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
