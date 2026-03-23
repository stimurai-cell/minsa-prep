import { fetchPushSubscriptions, getSupabaseAdmin, sendPushToSubscriptions } from './_lib/push.js';

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

function buildPushPayload(result: {
    id: string;
    final_rank: number;
    room_number: number | null;
    xp_earned: number;
    outcome: 'promoted' | 'stayed' | 'demoted';
    previous_league: string;
    new_league: string;
}) {
    if (result.outcome === 'promoted') {
        return {
            title: `Subiste para ${result.new_league}!`,
            body: `Fechaste a semana em #${result.final_rank} com ${result.xp_earned} XP. Abre a liga e ve a tua celebracao.`,
            tag: `league-result-${result.id}`,
        };
    }

    if (result.outcome === 'demoted') {
        return {
            title: 'Liga encerrada: nova oportunidade',
            body: `Terminaste em #${result.final_rank} na ${result.previous_league}. A nova rodada comeca agora na ${result.new_league}.`,
            tag: `league-result-${result.id}`,
        };
    }

    return {
        title: 'Liga encerrada',
        body: `Terminaste em #${result.final_rank} com ${result.xp_earned} XP e permaneces na ${result.new_league}.`,
        tag: `league-result-${result.id}`,
    };
}

async function sendPendingLeaguePushes(weekStart: string) {
    const supabase = getSupabaseAdmin();
    const { data: pendingResults, error } = await supabase
        .from('league_results')
        .select('id, user_id, final_rank, room_number, xp_earned, outcome, previous_league, new_league, push_sent_at')
        .eq('week_start_date', weekStart)
        .is('push_sent_at', null);

    if (error) {
        throw error;
    }

    let processed = 0;
    let sent = 0;
    let skippedWithoutDevice = 0;

    for (const result of pendingResults || []) {
        try {
            const subscriptions = await fetchPushSubscriptions(result.user_id);
            const payload = buildPushPayload(result as any);

            if (!subscriptions.length) {
                skippedWithoutDevice += 1;
                await supabase
                    .from('league_results')
                    .update({ push_sent_at: new Date().toISOString() })
                    .eq('id', result.id);
                processed += 1;
                continue;
            }

            const pushResult = await sendPushToSubscriptions(subscriptions, {
                title: payload.title,
                body: payload.body,
                url: '/leagues',
                tag: payload.tag,
            });

            sent += pushResult.sent;
            processed += 1;

            await supabase
                .from('league_results')
                .update({ push_sent_at: new Date().toISOString() })
                .eq('id', result.id);
        } catch (error) {
            console.error('[cron-leagues] Failed to push result:', result.id, error);
        }
    }

    return { processed, sent, skippedWithoutDevice };
}

export default async function handler(req: any, res: any) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const authHeader = req.headers?.authorization;
    const cronSecret = process.env.VERCEL_CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const body = await parseBody(req);
        const supabase = getSupabaseAdmin();
        const { data: finalizeResult, error: finalizeError } = await supabase.rpc('finalize_league_week', {
            p_week_start: body.weekStart || null,
        });

        if (finalizeError) {
            throw finalizeError;
        }

        const weekStart = finalizeResult?.week_start;
        const pushSummary = weekStart ? await sendPendingLeaguePushes(weekStart) : { processed: 0, sent: 0, skippedWithoutDevice: 0 };

        return res.status(200).json({
            finalize: finalizeResult,
            pushes: pushSummary,
        });
    } catch (err: any) {
        console.error('[cron-leagues] Error:', err);
        return res.status(500).json({
            error: err.message || 'Erro desconhecido ao fechar as ligas.',
        });
    }
}
