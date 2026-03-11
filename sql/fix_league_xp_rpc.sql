CREATE OR REPLACE FUNCTION increment_weekly_xp(p_user_id UUID, p_league_name TEXT, p_week_start DATE, p_xp INTEGER)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.weekly_league_stats (user_id, league_name, week_start_date, xp_earned)
    VALUES (p_user_id, p_league_name, p_week_start, p_xp)
    ON CONFLICT (user_id, week_start_date)
    DO UPDATE SET xp_earned = public.weekly_league_stats.xp_earned + p_xp;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
