import { supabase } from './supabase';

export interface Badge {
    id: string;
    name: string;
    description: string;
    icon_url: string | null;
    criteria_type: string;
    criteria_value: number;
}

/**
 * Checks if the user is eligible for any new badges and awards them.
 * @param userId User UUID
 * @returns Array of newly earned badges
 */
export async function checkForBadges(userId: string): Promise<Badge[]> {
    try {
        // 1. Get user's earned badges to avoid duplicates
        const { data: earnedBadges } = await supabase
            .from('user_badges')
            .select('badge_id')
            .eq('user_id', userId);

        const earnedIds = new Set(earnedBadges?.map(b => b.badge_id) || []);

        // 2. Get all available badges
        const { data: allBadges } = await supabase.from('badges').select('*');
        if (!allBadges) return [];

        const newlyEarned: Badge[] = [];

        for (const badge of allBadges) {
            if (earnedIds.has(badge.id)) continue;

            let isEligible = false;
            const now = new Date();
            const hour = now.getHours();

            // Logic based on badge criteria
            switch (badge.criteria_type) {
                case 'time':
                    if (badge.name === 'Corujão' && hour >= 22) isEligible = true;
                    if (badge.name === 'Madrugador' && hour >= 5 && hour < 7) isEligible = true;
                    break;

                case 'count':
                    // Check correct answers in user's area
                    const { data: progress } = await supabase
                        .from('user_topic_progress')
                        .select('correct_answers')
                        .eq('user_id', userId);

                    const totalCorrect = progress?.reduce((acc, p) => acc + (p.correct_answers || 0), 0) || 0;
                    if (totalCorrect >= badge.criteria_value) isEligible = true;
                    break;

                case 'streak':
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('streak_count')
                        .eq('id', userId)
                        .single();

                    if (profile && profile.streak_count >= badge.criteria_value) isEligible = true;
                    break;
            }

            if (isEligible) {
                // Award the badge
                const { error: insertError } = await supabase.from('user_badges').insert({
                    user_id: userId,
                    badge_id: badge.id,
                    earned_at: now.toISOString()
                });

                if (!insertError) {
                    newlyEarned.push(badge);
                }
            }
        }

        return newlyEarned;
    } catch (error) {
        console.error('Error checking for badges:', error);
        return [];
    }
}
