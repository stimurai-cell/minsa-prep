-- ==========================================
-- MINSA Prep: SOLUÇÃO DEFINITIVA PARA A LIGA
-- ==========================================
-- Execute este script no SQL Editor do Supabase. 
-- Ele corrige as permissões de visibilidade e a estrutura das ligas.

-- 1. Garantir que a tabela de estatísticas existe
CREATE TABLE IF NOT EXISTS public.weekly_league_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    league_name TEXT DEFAULT 'Bronze',
    xp_earned INTEGER DEFAULT 0,
    week_start_date DATE DEFAULT CURRENT_DATE,
    UNIQUE(user_id, week_start_date)
);

-- 2. Corrigir RLS da Tabela de Ligas
ALTER TABLE public.weekly_league_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all league stats" ON public.weekly_league_stats;
DROP POLICY IF EXISTS "Users can update their own weekly stats" ON public.weekly_league_stats;
DROP POLICY IF EXISTS "System can insert weekly stats" ON public.weekly_league_stats;

CREATE POLICY "Users can view all league stats" 
ON public.weekly_league_stats FOR SELECT 
USING (true);

CREATE POLICY "Users can update their own weekly stats" 
ON public.weekly_league_stats FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own weekly stats" 
ON public.weekly_league_stats FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- 3. CORREÇÃO CRÍTICA: Permitir que alunos vejam nomes uns dos outros
-- Sem isso, a Liga aparece vazia ou sem nomes porque o RLS bloqueia o "join" com Profiles.
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" 
ON public.profiles FOR SELECT 
USING (true);

-- 4. Função otimizada para incremento de XP (RPC)
CREATE OR REPLACE FUNCTION increment_weekly_xp(p_user_id UUID, p_league_name TEXT, p_week_start DATE, p_xp INTEGER)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.weekly_league_stats (user_id, league_name, week_start_date, xp_earned)
    VALUES (p_user_id, p_league_name, p_week_start, p_xp)
    ON CONFLICT (user_id, week_start_date)
    DO UPDATE SET xp_earned = public.weekly_league_stats.xp_earned + p_xp;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Garantir coluna de telefone
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
