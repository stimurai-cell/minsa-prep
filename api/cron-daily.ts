import { fetchPushSubscriptions, getSupabaseAdmin, sendPushToSubscriptions } from './_lib/push';

const morningMessages = [
    { title: 'Bom dia, futuro craque!', body: 'Que tal 15 minutinhos de treino agora para comecar o dia com o pe direito?' },
    { title: 'Hora de brilhar!', body: 'O teu objetivo esta cada dia mais perto. Faz algumas questoes no MINSA Prep para manteres o ritmo!' },
    { title: 'O cafe ja esta pronto?', body: 'Aproveita a energia da manha e responde ao Desafio Diario de hoje!' }
];

const eveningMessages = [
    { title: 'Boa noite, campeao!', body: 'Ja fizeste o teu treino de hoje? Ainda vais a tempo de nao perder a ofensiva!' },
    { title: 'Nao deixes para amanha...', body: 'Aquilo que podes aprender hoje! Entra rapido e consolida o teu conhecimento antes de dormir.' },
    { title: 'Falta pouco para terminar o dia!', body: 'Garante os teus XP de hoje e ve como subiste na liga. Bora treinar!' }
];

const DAY_ORDER_EN = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_ORDER_PT = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];

const normalizeDay = (key: string) => key
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

function getDayIndex(key: string): number {
    const normalized = normalizeDay(key);
    let idx = DAY_ORDER_EN.indexOf(normalized);
    if (idx === -1) idx = DAY_ORDER_PT.indexOf(normalized);
    return idx;
}

function findDayKeyByIndex(plan: Record<string, any>, index: number): string | null {
    return Object.keys(plan || {}).find((key) => getDayIndex(key) === index) || null;
}

function hasLowSimulation(dailyPlan: Record<string, any>): boolean {
    return Object.values(dailyPlan || {}).some(
        (activity: any) => activity?.type === 'simulation' && typeof activity.accuracy === 'number' && activity.accuracy < 60
    );
}

async function ensureInsight(userId: string, title: string, description: string) {
    const supabase = getSupabaseAdmin();
    const today = new Date();
    const todayStart = new Date(today.toDateString());
    const { data: existing } = await supabase
        .from('elite_insights')
        .select('id')
        .eq('user_id', userId)
        .eq('title', title)
        .gte('created_at', todayStart.toISOString())
        .limit(1);

    if (existing && existing.length > 0) return;

    await supabase.from('elite_insights').insert({
        user_id: userId,
        insight_type: 'recommendation',
        title,
        description,
        priority: 'high',
        actionable: true
    });
}

async function processEliteFlags() {
    const supabase = getSupabaseAdmin();
    const { data: plans } = await supabase
        .from('elite_study_plans')
        .select('id,user_id,week_start,week_end,daily_plan,status')
        .eq('status', 'active');

    const today = new Date();
    let replanFlags = 0;
    let lowSimFlags = 0;

    for (const plan of plans || []) {
        const weekStart = new Date(plan.week_start);
        const dayDiff = Math.floor((today.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24));

        let missedStreak = 0;
        for (let back = 1; back <= 2; back += 1) {
            const dayIndex = dayDiff - back;
            if (dayIndex < 0) continue;
            const key = findDayKeyByIndex(plan.daily_plan, dayIndex);
            if (!key) continue;
            const activity = plan.daily_plan[key];
            if (!activity?.completed) {
                missedStreak += 1;
            } else {
                missedStreak = 0;
            }
        }

        if (missedStreak >= 2) {
            await ensureInsight(
                plan.user_id,
                'Replanejar semana por faltas',
                'Perdeu duas sessoes seguidas; sugerir replanejamento automatico com carga reduzida.'
            );
            replanFlags += 1;
        }

        if (hasLowSimulation(plan.daily_plan)) {
            await ensureInsight(
                plan.user_id,
                'Revisao rapida antes do proximo simulado',
                'Ultimo simulado ficou abaixo de 60%. Inserir bloco curto de revisao antes do proximo.'
            );
            lowSimFlags += 1;
        }
    }

    return { replanFlags, lowSimFlags };
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

    const hour = new Date().getHours();
    const messagesPool = hour < 14 ? morningMessages : eveningMessages;
    const randomMessage = messagesPool[Math.floor(Math.random() * messagesPool.length)];

    try {
        const subscriptions = await fetchPushSubscriptions();

        if (!subscriptions.length) {
            return res.status(200).json({ sent: 0, message: 'No subscriptions found' });
        }

        const response = await sendPushToSubscriptions(subscriptions, {
            title: randomMessage.title,
            body: randomMessage.body,
            url: '/dashboard',
        });

        let flags = { replanFlags: 0, lowSimFlags: 0 };
        try {
            flags = await processEliteFlags();
        } catch (flagErr) {
            console.error('[cron-daily] flag processing error:', flagErr);
        }

        return res.status(200).json({
            sent: response.sent,
            failures: response.failures,
            total: response.total,
            message: `Enviados ${response.sent} avisos diarios: ${randomMessage.title}`,
            replanFlags: flags.replanFlags,
            lowSimFlags: flags.lowSimFlags
        });
    } catch (err: any) {
        console.error('[cron-daily] Error:', err);
        return res.status(500).json({ error: err.message });
    }
}
