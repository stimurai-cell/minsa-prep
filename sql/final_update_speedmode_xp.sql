-- ==========================================
-- SQL UPDATE - MINSA PREP (Speed Mode & XP)
-- ==========================================

-- 1. Função para incremento atómico de XP Total
-- Essencial para evitar discrepâncias entre XP Total e XP Semanal
CREATE OR REPLACE FUNCTION public.increment_total_xp(p_user_id UUID, p_xp INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE public.profiles
    SET total_xp = COALESCE(total_xp, 0) + p_xp
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Garantir que a tabela de Feed suporta os novos Méritos
-- (Opcional se já executou social_notifications.sql)
CREATE TABLE IF NOT EXISTS public.feed_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'achievement', 'news', 'battle', 'streak'
    content JSONB NOT NULL DEFAULT '{}',
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 3. Políticas de RLS para o Feed (Caso não existam)
ALTER TABLE public.feed_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public feed viewable by everyone') THEN
        CREATE POLICY "Public feed viewable by everyone" ON public.feed_items FOR SELECT USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can create achievements') THEN
        CREATE POLICY "Users can create achievements" ON public.feed_items FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
END$$;

-- 4. Inicializar XP como 0 para utilizadores que tenham NULL (Prevenção)
UPDATE public.profiles SET total_xp = 0 WHERE total_xp IS NULL;

COMMENT ON FUNCTION public.increment_total_xp IS 'Incrementa o XP Total de forma atómica para evitar perda de dados por simultaneidade.';
