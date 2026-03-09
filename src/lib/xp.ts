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
        // We use a specific 'xp_earned' type to make it easy for the league view to aggregate
        const { error: logError } = await supabase
            .from('activity_logs')
            .insert({
                user_id: userId,
                activity_type: 'xp_earned',
                activity_metadata: {
                    xp: xpAmount,
                    source: 'unified_awarding'
                }
            });

        if (logError) {
            console.error('Error logging XP activity, but profile was updated:', logError);
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
