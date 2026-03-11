-- MINSA Prep: Script Consolidado de Correção (Liga e Telefone)
-- Execute este script no SQL Editor do Supabase para aplicar as últimas mudanças.

-- 1. Adicionar coluna de telefone à tabela de perfis
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS phone TEXT;

-- 2. Garantir que a tabela de estatísticas semanais da liga existe
CREATE TABLE IF NOT EXISTS public.weekly_league_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    league_name TEXT DEFAULT 'Bronze',
    xp_earned INTEGER DEFAULT 0,
    week_start_date DATE DEFAULT CURRENT_DATE,
    UNIQUE(user_id, week_start_date)
);

-- 3. Habilitar RLS e Políticas para a tabela de ligas (se ainda não existirem)
ALTER TABLE public.weekly_league_stats ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view all league stats') THEN
        CREATE POLICY "Users can view all league stats" ON public.weekly_league_stats FOR SELECT USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own weekly stats') THEN
        CREATE POLICY "Users can update their own weekly stats" ON public.weekly_league_stats FOR UPDATE USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'System can insert weekly stats') THEN
        CREATE POLICY "System can insert weekly stats" ON public.weekly_league_stats FOR INSERT WITH CHECK (true);
    END IF;
END $$;

-- 4. Função auxiliar para incrementar XP semanal (Opcional, mas ajuda na consistência)
-- Esta função pode ser chamada via RPC se desejar, mas o código atual já lida com o upsert manual.
CREATE OR REPLACE FUNCTION increment_weekly_xp(p_user_id UUID, p_league_name TEXT, p_week_start DATE, p_xp INTEGER)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.weekly_league_stats (user_id, league_name, week_start_date, xp_earned)
    VALUES (p_user_id, p_league_name, p_week_start, p_xp)
    ON CONFLICT (user_id, week_start_date)
    DO UPDATE SET xp_earned = public.weekly_league_stats.xp_earned + p_xp;
END;
$$ LANGUAGE plpgsql;
