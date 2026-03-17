import admin from 'firebase-admin';
import { createClient } from '@supabase/supabase-js';
import type { IncomingMessage, ServerResponse } from 'http';

// Usar o service account gerado pelo Firebase
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: "farmolink-28",
            clientEmail: "firebase-adminsdk-fbsvc@farmolink-28.iam.gserviceaccount.com",
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || ""
        })
    });
}

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function send(res: ServerResponse, status: number, body: object) {
    const json = JSON.stringify(body);
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(json);
}

// Mensagens motivacionais super amigáveis
const morningMessages = [
    { title: "Bom dia, futuro craque! 🌅", body: "Que tal 15 minutinhos de treino agora para começar o dia com o pé direito?" },
    { title: "Hora de brilhar! ✨", body: "O teu objetivo está cada dia mais perto. Faz algumas questões no MINSA Prep para manteres o ritmo!" },
    { title: "O café já está pronto? ☕", body: "Aproveita a energia da manhã e responde ao Desafio Diário de hoje!" }
];

const eveningMessages = [
    { title: "Boa noite, campeão! 🌙", body: "Já fizeste o teu treino de hoje? Ainda vais a tempo de não perder a ofensiva!" },
    { title: "Não deixes para amanhã... 🎯", body: "Aquilo que podes aprender hoje! Entra rápido e consolida o teu conhecimento antes de dormir." },
    { title: "Falta pouco para terminar o dia! ⏳", body: "Garante os teus XP de hoje e vê como subiste na liga. Bora treinar!" }
];

const DAY_ORDER_EN = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const DAY_ORDER_PT = ['segunda','terca','quarta','quinta','sexta','sabado','domingo'];

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
    return Object.keys(plan || {}).find(k => getDayIndex(k) === index) || null;
}

function hasLowSimulation(dailyPlan: Record<string, any>): boolean {
    return Object.values(dailyPlan || {}).some((activity: any) => activity?.type === 'simulation' && typeof activity.accuracy === 'number' && activity.accuracy < 60);
}

async function ensureInsight(userId: string, title: string, description: string) {
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
        for (let back = 1; back <= 2; back++) {
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


export default async function handler(req: IncomingMessage, res: ServerResponse) {
    // Vercel Cron Jobs usam GET e um segredo para autorização, mas permitiremos POST para testes manuais
    if (req.method !== 'GET' && req.method !== 'POST') {
        return send(res, 405, { error: 'Method not allowed' });
    }

    // Cron job Authorization
    // Nota: Em produção deves configurar a VERCEL_CRON_SECRET nas variáveis de ambiente da Vercel
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.VERCEL_CRON_SECRET;

    // Verificamos apenas se a secret existir para não quebrar testes locais
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return send(res, 401, { error: 'Unauthorized' });
    }

    const hour = new Date().getHours();

    // Escolhe o pool de mensagens com base na hora do dia (Geralmente 9h ou 19h via vercel.json)
    const messagesPool = hour < 14 ? morningMessages : eveningMessages;
    const randomMessage = messagesPool[Math.floor(Math.random() * messagesPool.length)];

    try {
        const { data: subscriptions, error } = await supabase.from('push_subscriptions').select('endpoint, user_id');

        if (error) throw error;
        if (!subscriptions || subscriptions.length === 0) {
            return send(res, 200, { sent: 0, message: 'No subscriptions found' });
        }

        const tokens = subscriptions
            .map(sub => sub.endpoint)
            .filter(t => t && !t.startsWith('http'));

        if (tokens.length === 0) {
            return send(res, 200, { sent: 0, message: 'No valid FCM tokens found' });
        }

        const message = {
            notification: {
                title: randomMessage.title,
                body: randomMessage.body
            },
            data: {
                url: '/dashboard'
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

        let flags = { replanFlags: 0, lowSimFlags: 0 };
        try {
            flags = await processEliteFlags();
        } catch (flagErr) {
            console.error('[cron-daily] flag processing error:', flagErr);
        }

        return send(res, 200, {
            sent: response.successCount,
            message: `Enviados ${response.successCount} avisos diários: ${randomMessage.title}`,
            replanFlags: flags.replanFlags,
            lowSimFlags: flags.lowSimFlags
        });
    } catch (err: any) {
        console.error('[cron-daily] Error:', err);
        return send(res, 500, { error: err.message });
    }
}
