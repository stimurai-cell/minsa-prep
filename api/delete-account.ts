import { getSupabaseAdmin } from './_lib/push.js';

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

    const authHeader = req.headers?.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const body = await parseBody(req);
    if (!body.confirmDeletion) {
        return res.status(400).json({ error: 'Deletion confirmation is required.' });
    }

    try {
        const supabase = getSupabaseAdmin();
        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser(token);

        if (userError || !user) {
            return res.status(401).json({ error: 'Invalid session.' });
        }

        const userId = user.id;

        const cleanupTasks = [
            supabase.from('push_subscriptions').delete().eq('user_id', userId),
            supabase.from('support_messages').delete().eq('user_id', userId),
            supabase
                .from('battle_matches')
                .delete()
                .or(`winner_id.eq.${userId},challenger_id.eq.${userId},opponent_id.eq.${userId}`),
        ];

        await Promise.all(cleanupTasks);

        const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(userId);
        if (deleteAuthError) {
            throw deleteAuthError;
        }

        const { error: deleteProfileError } = await supabase
            .from('profiles')
            .delete()
            .eq('id', userId);

        if (deleteProfileError) {
            throw deleteProfileError;
        }

        return res.status(200).json({ success: true });
    } catch (error: any) {
        console.error('[delete-account] Error:', error);
        return res.status(500).json({
            error: error.message || 'Nao foi possivel excluir a conta agora.',
        });
    }
}
