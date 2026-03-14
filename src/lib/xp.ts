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

            // d) Fan-out: notificar seguidores (feed + push + inbox)
            const { data: followers } = await supabase
                .from('user_follows')
                .select('follower_id')
                .eq('following_id', userId);

            if (followers && followers.length > 0) {
                const followerNotifications = followers.map((f) => ({
                    user_id: f.follower_id,
                    title: 'Teu amigo atingiu um marco! 🏅',
                    body: `Atingiu ${crossedMilestone.toLocaleString()} XP. Vai lá parabenizar!`,
                    type: 'friend_activity',
                    link: `/profile/${userId}`
                }));
                await supabase.from('user_notifications').insert(followerNotifications);

                await Promise.all(
                    followers.slice(0, 30).map((f) =>
                        sendPushNotification({
                            userId: f.follower_id,
                            title: 'Teu amigo brilhou! 🎉',
                            body: `Alcançou ${crossedMilestone.toLocaleString()} XP.`,
                            url: `/profile/${userId}`
                        })
                    )
                );
            }
        }

        // --- 5. GAMIFICATION: Ofensiva diária via RPC dedicada (sem depender de horário/local) ---
        let currentStreak: number | undefined = undefined;
        try {
            const { data: streakResult, error: streakError } = await supabase.rpc('register_daily_streak', {
                p_user_id: userId
            });
            if (streakError) {
                console.error('[XP] Erro ao registar ofensiva diária:', streakError);
            } else if (streakResult) {
                currentStreak = (streakResult as any).streak_count ?? undefined;
            }
        } catch (streakErr) {
            console.error('[XP] Falha inesperada ao registar ofensiva diária:', streakErr);
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
