import { supabase } from './supabase';

export interface DailyTaskProgress {
    id: string;
    label: string;
    current: number;
    target: number;
    completed: boolean;
}

/**
 * Fetches the user's progress for daily tasks by analyzing today's activity logs.
 */
export const getDailyTasksProgress = async (userId: string): Promise<DailyTaskProgress[]> => {
    if (!userId) return [];

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    try {
        // Fetch all relevant logs for today
        // We check created_at >= today OR activity_date >= today to be safe
        const { data: logs, error } = await supabase
            .from('activity_logs')
            .select('activity_type, activity_metadata, created_at, activity_date')
            .eq('user_id', userId)
            .or(`created_at.gte.${today},activity_date.gte.${today}`);

        if (error) throw error;

        // 1. Task: Win 50 XP
        // Consider both 'xp_earned' logs and sessions that have 'xp' in metadata
        const totalXpToday = logs.reduce((acc, l) => {
            const xpFromMetadata = l.activity_metadata?.xp || 0;
            return acc + xpFromMetadata;
        }, 0);

        // 2. Task: Complete 2 Training Sessions
        const trainingsToday = logs.filter(l => l.activity_type === 'completed_training').length;

        // 3. Task: Perfect Score (100% in any session)
        const hasPerfectScore = logs.some(l =>
            (l.activity_type === 'completed_training' || l.activity_type === 'completed_simulation') &&
            l.activity_metadata?.correct === l.activity_metadata?.total &&
            l.activity_metadata?.total > 0
        );

        return [
            {
                id: 'xp_goal',
                label: 'Ganhe 50 XP hoje',
                current: totalXpToday,
                target: 50,
                completed: totalXpToday >= 50
            },
            {
                id: 'training_count',
                label: 'Complete 2 treinos',
                current: trainingsToday,
                target: 2,
                completed: trainingsToday >= 2
            },
            {
                id: 'perfect_score',
                label: 'Acerte tudo num treino',
                current: hasPerfectScore ? 1 : 0,
                target: 1,
                completed: hasPerfectScore
            }
        ];
    } catch (err) {
        console.error('Error calculating daily tasks:', err);
        return [];
    }
};
