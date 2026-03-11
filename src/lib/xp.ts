import { supabase } from './supabase';
import { sendPushNotification } from './pushNotifications';

export interface XpAwardResult {
    success: boolean;
    newTotalXp: number;
    xpEarned: number;
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
        const milestones = [1000, 5000, 10000, 25000, 50000, 100000];
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
        }

        // --- 5. GAMIFICATION: Verificação da Ofensiva (Streak) ---
        const { data: profileAfter } = await supabase
            .from('profiles')
            .select('streak_count')
            .eq('id', userId)
            .maybeSingle();

        const currentStreak = profileAfter?.streak_count || 0;
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
        }

        return {
            success: true,
            newTotalXp: newTotal,
            xpEarned: xpAmount
        };
    } catch (err) {
        console.error('Error awarding XP:', err);
        return { success: false, newTotalXp: currentTotalXp, xpEarned: 0 };
    }
};
