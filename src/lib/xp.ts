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

        if (logError) {
            console.error('Error logging XP activity:', logError);
        }

        // 3. Sync with weekly_league_stats
        // Calculate start of current week (Monday)
        const now = new Date();
        const first = now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1); // Get Monday
        const monday = new Date(now.setDate(first)).toISOString().split('T')[0];

        // Get user's current league
        const { data: profileData } = await supabase
            .from('profiles')
            .select('current_league')
            .eq('id', userId)
            .maybeSingle();

        const leagueName = profileData?.current_league || 'Bronze';

        // Manual upsert logic for weekly stats
        const { data: currentStats } = await supabase
            .from('weekly_league_stats')
            .select('xp_earned')
            .eq('user_id', userId)
            .eq('week_start_date', monday)
            .maybeSingle();

        if (currentStats) {
            await supabase
                .from('weekly_league_stats')
                .update({ xp_earned: (currentStats.xp_earned || 0) + xpAmount })
                .eq('user_id', userId)
                .eq('week_start_date', monday);
        } else {
            await supabase
                .from('weekly_league_stats')
                .insert({
                    user_id: userId,
                    league_name: leagueName,
                    week_start_date: monday,
                    xp_earned: xpAmount
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
