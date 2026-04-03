import { fetchPushSubscriptions, getSupabaseAdmin, sendPushToSubscriptions } from './_lib/push.js';

const APP_TIMEZONE = 'Africa/Luanda';
const CRON_WINDOW_MINUTES = 8;
const DEFAULT_STUDY_REMINDER_MINUTE = (18 * 60) - 10;
const COMEBACK_REMINDER_MINUTE = 12 * 60 + 30;

const studyReminderMessages = [
    (name: string) => ({
        title: 'Hora de estudar',
        body: `${name}, falta pouco para o teu horario habitual. Entra hoje e mantem o ritmo.`,
    }),
    (name: string) => ({
        title: 'Seu bloco de estudo esta a chegar',
        body: `${name}, prepara 10 minutos para aquecer. Uma sessao hoje protege o teu progresso.`,
    }),
    (name: string) => ({
        title: 'Vamos segurar essa consistencia',
        body: `${name}, o melhor momento para estudar esta quase ai. Abre o MINSA Prep e ganha tracao hoje.`,
    }),
];

const comebackMessages = [
    (name: string, daysAway: number) => ({
        title: 'Sentimos a tua falta',
        body: `${name}, ja faz ${daysAway} dia(s) desde a tua ultima sessao. Volta hoje com uma revisao curta e retoma o ritmo.`,
    }),
    (name: string, daysAway: number) => ({
        title: 'Hora de voltar ao foco',
        body: `${name}, o app esta pronto para te recolocar nos trilhos depois de ${daysAway} dia(s) fora.`,
    }),
];

const streakGuardMessages = [
    (name: string, streak: number, canFreeze: boolean) => ({
        title: 'A tua ofensiva esta em risco',
        body: canFreeze
            ? `${name}, tens ${streak} dias seguidos. Faz uma sessao hoje ou usa XP para proteger a ofensiva.`
            : `${name}, tens ${streak} dias seguidos. Faz uma sessao hoje para nao quebrar a ofensiva.`,
    }),
    (name: string, streak: number, canFreeze: boolean) => ({
        title: 'Nao deixa a chama apagar',
        body: canFreeze
            ? `${name}, a tua ofensiva de ${streak} dias merece protecao. Estuda hoje ou ativa a protecao com XP.`
            : `${name}, a tua ofensiva de ${streak} dias precisa de uma sessao hoje para continuar viva.`,
    }),
];

type UserProfileRow = {
    id: string;
    full_name?: string | null;
    total_xp?: number | null;
    streak_count?: number | null;
    streak_freeze_active?: boolean | null;
    last_active?: string | null;
    role?: string | null;
    elite_profiles?: Array<{
        preferred_study_hour?: string | null;
        study_days?: string[] | null;
    }> | {
        preferred_study_hour?: string | null;
        study_days?: string[] | null;
    } | null;
};

type ReminderIntent = {
    kind: 'study' | 'comeback' | 'streak_guard';
    title: string;
    body: string;
    link: string;
    type: 'marketing' | 'personal';
    dedupeKey: string;
};

const DAY_ORDER_EN = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const normalizeDay = (value: string) =>
    value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

const getProfileFirstName = (profile: UserProfileRow) =>
    String(profile.full_name || 'Estudante').trim().split(/\s+/)[0] || 'Estudante';

const getEliteProfile = (profile: UserProfileRow) =>
    Array.isArray(profile.elite_profiles) ? profile.elite_profiles[0] || null : profile.elite_profiles || null;

const getTimeParts = (date = new Date()) => {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: APP_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        weekday: 'long',
    });

    const parts = formatter.formatToParts(date);
    const read = (type: string) => parts.find((part) => part.type === type)?.value || '';
    const year = read('year');
    const month = read('month');
    const day = read('day');
    const hour = Number(read('hour') || '0');
    const minute = Number(read('minute') || '0');
    const weekday = normalizeDay(read('weekday'));

    return {
        dateKey: `${year}-${month}-${day}`,
        hour,
        minute,
        minuteOfDay: hour * 60 + minute,
        weekday,
    };
};

const getDateKeyInTimezone = (value?: string | null) => {
    if (!value) return null;
    return getTimeParts(new Date(value)).dateKey;
};

const diffDateKeys = (earlier: string, later: string) =>
    Math.round((new Date(`${later}T00:00:00Z`).getTime() - new Date(`${earlier}T00:00:00Z`).getTime()) / (24 * 60 * 60 * 1000));

const minutesDistance = (left: number, right: number) => {
    const delta = Math.abs(left - right);
    return Math.min(delta, 1440 - delta);
};

const isWithinCronWindow = (currentMinute: number, targetMinute: number) =>
    minutesDistance(currentMinute, targetMinute) <= CRON_WINDOW_MINUTES;

const parseHourToReminderMinute = (value?: string | null) => {
    if (!value || !/^\d{2}:\d{2}/.test(value)) return null;
    const [rawHour, rawMinute] = value.slice(0, 5).split(':');
    const hour = Number(rawHour);
    const minute = Number(rawMinute);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;

    return (((hour * 60) + minute - 10) + 1440) % 1440;
};

const inferReminderMinute = (profile: UserProfileRow) => {
    const eliteProfile = getEliteProfile(profile);
    const preferredMinute = parseHourToReminderMinute(eliteProfile?.preferred_study_hour);
    if (preferredMinute !== null) {
        return preferredMinute;
    }

    const lastActive = profile.last_active ? new Date(profile.last_active) : null;
    if (lastActive) {
        const parts = getTimeParts(lastActive);
        return (((parts.hour * 60) + parts.minute - 10) + 1440) % 1440;
    }

    return DEFAULT_STUDY_REMINDER_MINUTE;
};

const isStudyDayEnabled = (profile: UserProfileRow, weekday: string) => {
    const studyDays = getEliteProfile(profile)?.study_days || [];
    if (!studyDays.length) return true;
    return studyDays.map((item) => normalizeDay(item)).includes(weekday);
};

const pickMessage = <T,>(messages: T[], seed: string) => {
    const hash = Array.from(seed).reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return messages[hash % messages.length];
};

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

    const findDayKeyByIndex = (plan: Record<string, any>, index: number) =>
        Object.keys(plan || {}).find((key) => {
            const normalized = normalizeDay(key);
            const idx = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].indexOf(normalized);
            return idx === index;
        }) || null;

    const hasLowSimulation = (dailyPlan: Record<string, any>) =>
        Object.values(dailyPlan || {}).some(
            (activity: any) => activity?.type === 'simulation' && typeof activity.accuracy === 'number' && activity.accuracy < 60
        );

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

async function dispatchReminder(profile: UserProfileRow, intent: ReminderIntent, pushRows: any[]) {
    const supabase = getSupabaseAdmin();
    try {
        const { error: logError } = await supabase.from('notification_dispatch_logs').insert({
            user_id: profile.id,
            channel: 'push',
            kind: intent.kind,
            dedupe_key: intent.dedupeKey,
            payload: {
                title: intent.title,
                body: intent.body,
                link: intent.link,
                type: intent.type,
            },
        });

        if (logError) {
            if (logError.code === '23505') {
                return { sent: 0, skipped: true };
            }
            throw logError;
        }
    } catch (error: any) {
        const code = String(error?.code || '');
        const message = String(error?.message || '').toLowerCase();
        const canFallback = code === '42P01' || code === 'PGRST205' || message.includes('notification_dispatch_logs');

        if (!canFallback) {
            throw error;
        }

        const todayStartIso = new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z';
        const { data: existing, error: existingError } = await supabase
            .from('user_notifications')
            .select('id')
            .eq('user_id', profile.id)
            .eq('title', intent.title)
            .eq('link', intent.link)
            .gte('created_at', todayStartIso)
            .limit(1);

        if (existingError) {
            throw existingError;
        }

        if ((existing || []).length > 0) {
            return { sent: 0, skipped: true };
        }
    }

    await supabase.from('user_notifications').insert({
        user_id: profile.id,
        title: intent.title,
        body: intent.body,
        type: intent.type,
        link: intent.link,
    });

    if (!pushRows.length) {
        return { sent: 0, skipped: false };
    }

    const result = await sendPushToSubscriptions(pushRows, {
        title: intent.title,
        body: intent.body,
        url: intent.link,
        tag: intent.dedupeKey,
    });

    return { sent: result.sent, skipped: false };
}

function buildReminderIntent(profile: UserProfileRow, nowParts: ReturnType<typeof getTimeParts>) {
    const firstName = getProfileFirstName(profile);
    const streakCount = Number(profile.streak_count || 0);
    const canFreeze = Boolean(!profile.streak_freeze_active && Number(profile.total_xp || 0) >= 1000);
    const lastActiveDateKey = getDateKeyInTimezone(profile.last_active);
    const activeToday = lastActiveDateKey === nowParts.dateKey;
    const inactiveDays = lastActiveDateKey ? diffDateKeys(lastActiveDateKey, nowParts.dateKey) : 999;
    const reminderMinute = inferReminderMinute(profile);

    if (inactiveDays >= 2 && isWithinCronWindow(nowParts.minuteOfDay, COMEBACK_REMINDER_MINUTE)) {
        const message = pickMessage(comebackMessages, `${profile.id}:${nowParts.dateKey}:comeback`)(firstName, inactiveDays);
        return {
            kind: 'comeback',
            title: message.title,
            body: message.body,
            link: '/dashboard',
            type: 'marketing',
            dedupeKey: `comeback:${profile.id}:${nowParts.dateKey}`,
        } satisfies ReminderIntent;
    }

    if (!activeToday && streakCount > 0 && isWithinCronWindow(nowParts.minuteOfDay, 20 * 60 + 30)) {
        const message = pickMessage(streakGuardMessages, `${profile.id}:${nowParts.dateKey}:streak`)(firstName, streakCount, canFreeze);
        return {
            kind: 'streak_guard',
            title: message.title,
            body: message.body,
            link: '/dashboard',
            type: 'personal',
            dedupeKey: `streak-guard:${profile.id}:${nowParts.dateKey}`,
        } satisfies ReminderIntent;
    }

    if (!activeToday && isWithinCronWindow(nowParts.minuteOfDay, reminderMinute)) {
        const message = pickMessage(studyReminderMessages, `${profile.id}:${nowParts.dateKey}:study`)(firstName);
        return {
            kind: 'study',
            title: message.title,
            body: message.body,
            link: '/dashboard',
            type: 'marketing',
            dedupeKey: `study:${profile.id}:${nowParts.dateKey}`,
        } satisfies ReminderIntent;
    }

    return null;
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
        const supabase = getSupabaseAdmin();
        const nowParts = getTimeParts();
        const [profilesResult, subscriptions, flags] = await Promise.all([
            supabase
                .from('profiles')
                .select('id, full_name, total_xp, streak_count, streak_freeze_active, last_active, role, elite_profiles(preferred_study_hour, study_days)')
                .neq('role', 'admin'),
            fetchPushSubscriptions(),
            processEliteFlags().catch((flagErr) => {
                console.error('[cron-daily] flag processing error:', flagErr);
                return { replanFlags: 0, lowSimFlags: 0 };
            }),
        ]);

        if (profilesResult.error) {
            throw profilesResult.error;
        }

        const profiles = (profilesResult.data || []) as UserProfileRow[];
        const pushRowsByUser = new Map<string, any[]>();
        subscriptions.forEach((row) => {
            if (!row.user_id) return;
            const bucket = pushRowsByUser.get(row.user_id) || [];
            bucket.push(row);
            pushRowsByUser.set(row.user_id, bucket);
        });

        let processed = 0;
        let sent = 0;
        let skipped = 0;

        for (const profile of profiles) {
            if (!isStudyDayEnabled(profile, nowParts.weekday)) {
                continue;
            }

            const intent = buildReminderIntent(profile, nowParts);
            if (!intent) {
                continue;
            }

            const result = await dispatchReminder(profile, intent, pushRowsByUser.get(profile.id) || []);
            processed += 1;
            sent += result.sent;
            skipped += result.skipped ? 1 : 0;
        }

        return res.status(200).json({
            ok: true,
            processed,
            sent,
            skipped,
            date_key: nowParts.dateKey,
            minute_of_day: nowParts.minuteOfDay,
            replanFlags: flags.replanFlags,
            lowSimFlags: flags.lowSimFlags,
        });
    } catch (err: any) {
        console.error('[cron-daily] Error:', err);
        return res.status(500).json({ error: err.message || 'Unexpected cron error' });
    }
}
