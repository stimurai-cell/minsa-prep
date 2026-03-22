import { countRegisteredPushDevices, fetchPushSubscriptions } from './_lib/push.js';

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

    try {
        const { userId } = await parseBody(req);

        if (!userId) {
            return res.status(400).json({ error: 'userId is required' });
        }

        const subscriptions = await fetchPushSubscriptions(userId);

        return res.status(200).json({
            count: countRegisteredPushDevices(subscriptions),
        });
    } catch (error: any) {
        console.error('[push-status] Error:', error);
        return res.status(500).json({ error: error.message || 'Unexpected error' });
    }
}
