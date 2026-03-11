-- Tabela de seguidores
CREATE TABLE IF NOT EXISTS public.user_follows (
    follower_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    following_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (follower_id, following_id)
);

-- Tabela de atividades (para o feed)
CREATE TABLE IF NOT EXISTS public.user_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL, -- 'achievement', 'follow', 'high_score'
    content TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Adicionar flag de perfil público
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT TRUE;

-- Habilitar RLS
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activities ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Anyone can view follows" ON public.user_follows FOR SELECT USING (true);
CREATE POLICY "Users can follow others" ON public.user_follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users can unfollow others" ON public.user_follows FOR DELETE USING (auth.uid() = follower_id);

CREATE POLICY "Anyone can view activities" ON public.user_activities FOR SELECT USING (true);
CREATE POLICY "Users can create activities" ON public.user_activities FOR INSERT WITH CHECK (auth.uid() = user_id);
