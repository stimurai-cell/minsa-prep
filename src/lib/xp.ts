import { supabase } from './supabase';
import { sendPushNotification } from './pushNotifications';

export interface XpAwardResult {
    success: boolean;
    newTotalXp: number;
    xpEarned: number;
    crossedMilestone?: number;
    newStreak?: number;
}

/**
 * Awards XP to a user, updates their profile, and logs the activity.
 * The log ensures the weekly league stats can aggregate this XP.
 */
export const awardXp = async (userId: string, xpAmount: number, currentTotalXp: number): Promise<XpAwardResult> => {
    if (!userId || xpAmount <= 0) {
        return { success: false, newTotalXp: currentTotalXp, xpEarned: 0 };
    }

    try {
        const newTotal = (currentTotalXp || 0) + xpAmount;

        // 1. Update Profile Total XP atomically
        const { error: profileError } = await supabase.rpc('increment_total_xp', {
            p_user_id: userId,
            p_xp: xpAmount
        });

        if (profileError) throw profileError;

        // 2. Log Activity for League Sync
        const { error: logError } = await supabase
            .from('activity_logs')
            .insert({
                user_id: userId,
                activity_type: 'xp_earned',
                activity_date: new Date().toISOString(),
                activity_metadata: {
                    xp: xpAmount,
                    source: 'unified_awarding'
                }
            });

        // 3. Sync with weekly_league_stats via RPC for atomic increment
        // Calcular o início da semana (Segunda-feira) de forma robusta e independente de UTC shift
        const now = new Date();
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        const mondayDate = new Date(now.getFullYear(), now.getMonth(), diff);
        const monday = `${mondayDate.getFullYear()}-${String(mondayDate.getMonth() + 1).padStart(2, '0')}-${String(mondayDate.getDate()).padStart(2, '0')}`;

        console.log(`[XP] Sincronizando liga para usuário ${userId}. Semana: ${monday}, XP: ${xpAmount}`);

        const { data: profileData } = await supabase
            .from('profiles')
            .select('current_league')
            .eq('id', userId)
            .maybeSingle();

        const leagueName = profileData?.current_league || 'Bronze';

        // Usa a função RPC increment_weekly_xp definida no banco de dados para evitar sobrescrita e race conditions
        const { error: leagueError } = await supabase.rpc('increment_weekly_xp', {
            p_user_id: userId,
            p_league_name: leagueName,
            p_week_start: monday,
            p_xp: xpAmount
        });

        if (leagueError) {
            console.error('[XP] Erro ao sincronizar liga via RPC:', leagueError);
        }

        // --- 4. GAMIFICATION: Verificação de Marcos Simbólicos (Milestones) ---
        const milestones = [50, 100, 250, 500, 750, 1000, 2500, 5000, 10000, 25000, 50000, 100000];
        const crossedMilestone = milestones.find(m => currentTotalXp < m && newTotal >= m);

        if (crossedMilestone) {
            console.log(`[Gamification] Usuário ${userId} alcançou o marco de ${crossedMilestone} XP!`);

            // a) Gerar Publicação Automática no Feed
            const { error: feedError } = await supabase.from('feed_items').insert({
                user_id: userId,
                type: 'achievement',
                content: {
                    title: 'Novo Marco Alcançado! 🎉',
                    body: `Alcançou incríveis ${crossedMilestone.toLocaleString()} XP acumulados. Continue assim, o limite é o céu!`,
                    score: crossedMilestone
                }
            });

            if (feedError) console.error('[Gamification] Erro ao postar no feed:', feedError);

            // b) Disparar Push Notification Persuasiva e Motivadora
            await sendPushNotification({
                userId,
                title: 'Parabéns, Campeão! 👑',
                body: `Acabaste de bater a meta fantástica de ${crossedMilestone.toLocaleString()} XP. O teu esforço está a dar frutos!`,
                url: '/news'
            });

            // c) In-app real-time Notification Toast
            await supabase.from('user_notifications').insert({
                user_id: userId,
                title: 'Novo Marco Alcançado! 👑',
                body: `Acabaste de bater a meta fantástica de ${crossedMilestone.toLocaleString()} XP. O teu esforço está a dar frutos!`,
                type: 'achievement'
            });
        }

        // --- 5. GAMIFICATION: Verificação da Ofensiva (Streak) COM FUSO HORÁRIO DE ANGOLA ---
        const { data: profileAfter } = await supabase
            .from('profiles')
            .select('streak_count, streak_freeze_active')
            .eq('id', userId)
            .maybeSingle();

        let currentStreak = profileAfter?.streak_count || 0;
        const streakFreezeActive = profileAfter?.streak_freeze_active || false;

        const angolaTime = new Date(now.toLocaleString("en-US", { timeZone: "Africa/Luanda" }));
        const startOfToday = new Date(angolaTime.getFullYear(), angolaTime.getMonth(), angolaTime.getDate()).getTime();

        // Verificar o ultimo login de XP antes deste que acabamos de inserir
        const { data: recentLogs } = await supabase
            .from('activity_logs')
            .select('created_at')
            .eq('user_id', userId)
            .eq('activity_type', 'xp_earned')
            .order('created_at', { ascending: false })
            .limit(2);

        // Define a lógica da Ofensiva Real
        if (recentLogs && recentLogs.length > 1) {
            const lastLog = recentLogs[1].created_at;
            const lastAngolaTime = new Date(new Date(lastLog).toLocaleString("en-US", { timeZone: "Africa/Luanda" }));
            const startOfLast = new Date(lastAngolaTime.getFullYear(), lastAngolaTime.getMonth(), lastAngolaTime.getDate()).getTime();

            const daysDiff = Math.round((startOfToday - startOfLast) / (1000 * 60 * 60 * 24));

            if (daysDiff === 1) {
                // Fez ontem, incrementa a ofensiva
                currentStreak += 1;
                await supabase.from('profiles').update({ streak_count: currentStreak }).eq('id', userId);
            } else if (daysDiff > 1) {
                // Perdeu 1 dia ou mais (Quebrou a ofensiva)
                if (streakFreezeActive) {
                    currentStreak += 1; // Salvo pelo protetor
                    await supabase.from('profiles').update({ streak_count: currentStreak, streak_freeze_active: false }).eq('id', userId);
                } else {
                    currentStreak = 1; // Voltou à estaca zero (ofensiva recomeça hoje)
                    await supabase.from('profiles').update({ streak_count: currentStreak }).eq('id', userId);
                }
            }
            // Se daysDiff === 0 (hoje já fez), não incrementa nem perde
        } else if (!recentLogs || recentLogs.length <= 1) {
            // Primeiro XP de sempre!
            currentStreak = 1;
            await supabase.from('profiles').update({ streak_count: currentStreak }).eq('id', userId);
        }

        const streakMilestones = [3, 7, 14, 30, 50, 100, 365]; // Dias

        // Só alertar se a ofensiva for exatamente igual a um marco (para não repetir)
        if (streakMilestones.includes(currentStreak)) {
            // Verificar se já não demos parabéns por isto recentemente (opcional, mas como "currentStreak" exato é difícil repetir, é seguro)
            await supabase.from('feed_items').insert({
                user_id: userId,
                type: 'streak',
                content: {
                    title: 'Ofensiva Lendária! 🔥',
                    body: `Impressionante! Mantiveste o teu foco durante ${currentStreak} dias consecutivos. És uma verdadeira inspiração!`,
                    streak_days: currentStreak
                }
            });

            await sendPushNotification({
                userId,
                title: `${currentStreak} Dias de Foco! 🔥`,
                body: `Estás imbatível! Alcançaste a ofesiva monumental de ${currentStreak} dias consecutivos. Parabéns!`,
                url: '/news'
            });

            await supabase.from('user_notifications').insert({
                user_id: userId,
                title: `${currentStreak} Dias de Foco! 🔥`,
                body: `Estás imbatível! Ofesiva de ${currentStreak} dias consecutivos. Parabéns!`,
                type: 'streak'
            });
        }

        return {
            success: true,
            newTotalXp: newTotal,
            xpEarned: xpAmount,
            crossedMilestone: crossedMilestone,
            newStreak: currentStreak
        };
    } catch (err) {
        console.error('Error awarding XP:', err);
        return { success: false, newTotalXp: currentTotalXp, xpEarned: 0 };
    }
};
