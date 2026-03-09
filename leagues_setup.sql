-- Adicionar campos de engajamento ao perfil
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS current_league TEXT DEFAULT 'Bronze',
ADD COLUMN IF NOT EXISTS streak_freeze_active BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_streak_freeze_at TIMESTAMPTZ;

-- Tabela para rastrear XP semanal (resetada via Cron ou Edge Function)
CREATE TABLE IF NOT EXISTS public.weekly_league_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    league_name TEXT DEFAULT 'Bronze',
    xp_earned INTEGER DEFAULT 0,
    week_start_date DATE DEFAULT CURRENT_DATE,
    UNIQUE(user_id, week_start_date)
);

-- Habilitar RLS
ALTER TABLE public.weekly_league_stats ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Users can view all league stats" 
ON public.weekly_league_stats FOR SELECT 
USING (true);

CREATE POLICY "Users can update their own weekly stats" 
ON public.weekly_league_stats FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "System can insert weekly stats" 
ON public.weekly_league_stats FOR INSERT 
WITH CHECK (true);
