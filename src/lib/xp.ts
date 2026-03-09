import { supabase } from './supabase';

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

        // 1. Update Profile Total XP
        const { error: profileError } = await supabase
            .from('profiles')
            .update({ total_xp: newTotal })
            .eq('id', userId);

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

        // 3. Sync with weekly_league_stats
        // Calcular o início da semana (Segunda-feira) de forma robusta
        const date = new Date();
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(date.setDate(diff)).toISOString().split('T')[0];

        console.log(`[XP] Sincronizando liga para usuário ${userId}. Semana: ${monday}, XP: ${xpAmount}`);

        const { data: profileData } = await supabase
            .from('profiles')
            .select('current_league')
            .eq('id', userId)
            .maybeSingle();

        const leagueName = profileData?.current_league || 'Bronze';

        // Tenta fazer o upsert - O Postgres usará a restrição UNIQUE(user_id, week_start_date)
        const { error: leagueError } = await supabase
            .from('weekly_league_stats')
            .upsert({
                user_id: userId,
                league_name: leagueName,
                week_start_date: monday,
                xp_earned: xpAmount // Nota: Este campo precisa ser acumulado se já existir
            }, {
                onConflict: 'user_id,week_start_date'
            });

        // Como o upsert substitui, precisamos de uma estratégia para incrementar.
        // Se o upsert acima não suportar incremento nativo (depende da config de RLS/DB),
        // usamos a lógica manual com verificação de erro.
        if (!leagueError) {
            // Recuperar o valor atual para somar corretamente no frontend ou usar RPC
            const { data: currentWeek } = await supabase
                .from('weekly_league_stats')
                .select('xp_earned')
                .eq('user_id', userId)
                .eq('week_start_date', monday)
                .maybeSingle();

            await supabase
                .from('weekly_league_stats')
                .update({ xp_earned: (currentWeek?.xp_earned || 0) + xpAmount })
                .eq('user_id', userId)
                .eq('week_start_date', monday);
        } else {
            console.error('[XP] Erro ao sincronizar liga:', leagueError);
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
