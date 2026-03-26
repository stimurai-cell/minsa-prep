import { supabase } from './supabase';
import { sendPushNotification } from './pushNotifications';
import { registerDailyStreak } from './streak';
import { getLeagueWeekStart } from './leagues';

export interface XpAwardResult {
    success: boolean;
    newTotalXp: number;
    xpEarned: number;
    crossedMilestone?: number;
    newStreak?: number;
}

export interface WeeklyLeagueSyncResult {
    synced: boolean;
    weekStart: string;
    xpEarned?: number;
    leagueName?: string;
    roomNumber?: number | null;
    reason?: string;
}

async function milestoneFeedAlreadyExists(userId: string, milestone: number) {
    const { data, error } = await supabase
        .from('feed_items')
        .select('id')
        .eq('user_id', userId)
        .eq('type', 'achievement')
        .contains('content', {
            title: 'Novo Marco Alcançado! 🎉',
            score: milestone,
        })
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error('[Gamification] Failed to check existing milestone feed item:', error);
        return false;
    }

    return Boolean(data?.id);
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

        const { error: profileError } = await supabase.rpc('increment_total_xp', {
            p_user_id: userId,
            p_xp: xpAmount
        });

        if (profileError) throw profileError;

        await supabase
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

        const weekStart = getLeagueWeekStart();

        console.log(`[XP] Syncing league for user ${userId}. Week: ${weekStart}, XP: ${xpAmount}`);

        const { data: profileData } = await supabase
            .from('profiles')
            .select('current_league')
            .eq('id', userId)
            .maybeSingle();

        const leagueName = profileData?.current_league || 'Bronze';

        const { error: leagueError } = await supabase.rpc('increment_weekly_xp', {
            p_user_id: userId,
            p_league_name: leagueName,
            p_week_start: weekStart,
            p_xp: xpAmount
        });

        if (leagueError) {
            console.error('[XP] Error syncing league via RPC:', leagueError);
            await syncUserWeeklyLeagueXp(userId, weekStart);
        }

        const milestones = [50, 100, 250, 500, 750, 1000, 2500, 5000, 10000, 25000, 50000, 100000];
        const crossedMilestone = milestones.find((milestone) => currentTotalXp < milestone && newTotal >= milestone);

        if (crossedMilestone) {
            console.log(`[Gamification] User ${userId} reached milestone ${crossedMilestone} XP`);

            const alreadyPosted = await milestoneFeedAlreadyExists(userId, crossedMilestone);
            if (!alreadyPosted) {
                const { error: feedError } = await supabase.from('feed_items').insert({
                    user_id: userId,
                    type: 'achievement',
                    content: {
                        title: 'Novo Marco Alcançado! 🎉',
                        body: `Alcançou incríveis ${crossedMilestone.toLocaleString()} XP acumulados. Continue assim, o limite é o céu!`,
                        score: crossedMilestone
                    }
                });

                if (feedError && feedError.code !== '23505') {
                    console.error('[Gamification] Error posting milestone to feed:', feedError);
                }
            }

            await sendPushNotification({
                userId,
                title: 'Parabéns, Campeão! 👑',
                body: `Acabaste de bater a meta fantástica de ${crossedMilestone.toLocaleString()} XP. O teu esforço está a dar frutos!`,
                url: '/news'
            });

            await supabase.from('user_notifications').insert({
                user_id: userId,
                title: 'Novo Marco Alcançado! 👑',
                body: `Acabaste de bater a meta fantástica de ${crossedMilestone.toLocaleString()} XP. O teu esforço está a dar frutos!`,
                type: 'achievement'
            });

            const { data: followers } = await supabase
                .from('user_follows')
                .select('follower_id')
                .eq('following_id', userId);

            if (followers && followers.length > 0) {
                const followerNotifications = followers.map((follower) => ({
                    user_id: follower.follower_id,
                    title: 'Teu amigo atingiu um marco! 🏅',
                    body: `Atingiu ${crossedMilestone.toLocaleString()} XP. Vai lá parabenizar!`,
                    type: 'friend_activity',
                    link: `/profile/${userId}`
                }));

                await supabase.from('user_notifications').insert(followerNotifications);

                await Promise.all(
                    followers.slice(0, 30).map((follower) =>
                        sendPushNotification({
                            userId: follower.follower_id,
                            title: 'Teu amigo brilhou! 🎉',
                            body: `Alcançou ${crossedMilestone.toLocaleString()} XP.`,
                            url: `/profile/${userId}`
                        })
                    )
                );
            }
        }

        let currentStreak: number | undefined;
        try {
            const streakResult = await registerDailyStreak(userId);
            if (streakResult) {
                currentStreak = streakResult.streakCount;
            }
        } catch (streakErr) {
            console.error('[XP] Unexpected failure while registering daily streak:', streakErr);
        }

        return {
            success: true,
            newTotalXp: newTotal,
            xpEarned: xpAmount,
            crossedMilestone,
            newStreak: currentStreak
        };
    } catch (err) {
        console.error('Error awarding XP:', err);
        return { success: false, newTotalXp: currentTotalXp, xpEarned: 0 };
    }
};

export const syncUserWeeklyLeagueXp = async (userId: string, weekStart = getLeagueWeekStart()): Promise<WeeklyLeagueSyncResult> => {
    if (!userId) {
        return {
            synced: false,
            weekStart,
            reason: 'missing_user',
        };
    }

    try {
        const { data, error } = await supabase.rpc('sync_user_weekly_league_xp', {
            p_user_id: userId,
            p_week_start: weekStart,
        });

        if (error) {
            console.error('[XP] Error running weekly league sync:', error);
            return {
                synced: false,
                weekStart,
                reason: error.message || 'rpc_error',
            };
        }

        return {
            synced: Boolean(data?.synced),
            weekStart: String(data?.week_start || weekStart),
            xpEarned: typeof data?.xp_earned === 'number' ? data.xp_earned : undefined,
            leagueName: typeof data?.league_name === 'string' ? data.league_name : undefined,
            roomNumber: typeof data?.room_number === 'number' ? data.room_number : null,
            reason: typeof data?.reason === 'string' ? data.reason : undefined,
        };
    } catch (error) {
        console.error('[XP] Unexpected weekly league sync failure:', error);
        return {
            synced: false,
            weekStart,
            reason: 'unexpected_error',
        };
    }
};
