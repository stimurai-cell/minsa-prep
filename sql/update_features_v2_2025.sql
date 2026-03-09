-- MINSA Prep - Atualização de Funcionalidades 2025 (Consolidação de Chat)
-- Este arquivo unifica todas as mudanças feitas durante esta sessão: 
-- SRS, Duelos 1v1, Mentor IA, Feed Social e Notificações.

-- 1. Repetição Espaçada (SRS)
CREATE TABLE IF NOT EXISTS public.user_question_srs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
  interval INT DEFAULT 0,
  ease_factor FLOAT DEFAULT 2.5,
  repetitions INT DEFAULT 0,
  next_review TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  last_reviewed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, question_id)
);
ALTER TABLE public.user_question_srs ENABLE ROW LEVEL SECURITY;

-- 2. Duelos XP 1v1 (Realtime Battle)
CREATE TABLE IF NOT EXISTS public.battle_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  opponent_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  area_id UUID REFERENCES public.areas(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending', 
  challenger_score INT DEFAULT 0,
  opponent_score INT DEFAULT 0,
  winner_id UUID REFERENCES public.profiles(id),
  xp_stake INT DEFAULT 50,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  completed_at TIMESTAMP WITH TIME ZONE
);
ALTER TABLE public.battle_matches ENABLE ROW LEVEL SECURITY;

-- 3. Mentor IA Logs
CREATE TABLE IF NOT EXISTS public.ai_mentor_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  advice_text TEXT NOT NULL,
  weakness_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);
ALTER TABLE public.ai_mentor_logs ENABLE ROW LEVEL SECURITY;

-- 4. Feed Social (Achievements, News, Interactions)
CREATE TABLE IF NOT EXISTS public.feed_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'achievement', 'news', 'battle', 'streak'
    content JSONB NOT NULL DEFAULT '{}',
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE IF NOT EXISTS public.feed_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feed_item_id UUID REFERENCES public.feed_items(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL DEFAULT '❤️',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(feed_item_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS public.feed_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feed_item_id UUID REFERENCES public.feed_items(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE public.feed_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_comments ENABLE ROW LEVEL SECURITY;

-- 5. Sistema de Notificações
CREATE TABLE IF NOT EXISTS public.user_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    type TEXT DEFAULT 'system',
    link TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

-- 6. Políticas de Segurança (RLS)
DO $$
BEGIN
    -- SRS
    DROP POLICY IF EXISTS "Users can view own SRS data" ON user_question_srs;
    DROP POLICY IF EXISTS "Users can update own SRS data" ON user_question_srs;
    -- Battle
    DROP POLICY IF EXISTS "Users can view matches" ON battle_matches;
    -- Mentor
    DROP POLICY IF EXISTS "Users can view own mentor logs" ON ai_mentor_logs;
    -- Feed
    DROP POLICY IF EXISTS "Public feed viewable by everyone" ON feed_items;
    DROP POLICY IF EXISTS "Admins can manage feed items" ON feed_items;
    DROP POLICY IF EXISTS "Anyone can react to feed" ON feed_reactions;
    DROP POLICY IF EXISTS "Anyone can view comments" ON feed_comments;
    DROP POLICY IF EXISTS "Users can comment on feed" ON feed_comments;
    -- Notifications
    DROP POLICY IF EXISTS "Users can view own notifications" ON user_notifications;
    DROP POLICY IF EXISTS "Admins can manage notifications" ON user_notifications;
END$$;

CREATE POLICY "Users can view own SRS data" ON user_question_srs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own SRS data" ON user_question_srs FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view matches" ON battle_matches FOR SELECT USING (auth.uid() = challenger_id OR auth.uid() = opponent_id);

CREATE POLICY "Users can view own mentor logs" ON ai_mentor_logs FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Public feed viewable by everyone" ON feed_items FOR SELECT USING (true);
CREATE POLICY "Admins can manage feed items" ON feed_items FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Anyone can react to feed" ON feed_reactions FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Anyone can view comments" ON feed_comments FOR SELECT USING (true);
CREATE POLICY "Users can comment on feed" ON feed_comments FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own notifications" ON user_notifications FOR SELECT USING (
    user_id = auth.uid() OR user_id IS NULL
);
CREATE POLICY "Admins can manage notifications" ON user_notifications FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 7. Funções e Triggers de Engajamento
CREATE OR REPLACE FUNCTION public.create_feed_item_from_activity()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.activity_type = 'completed_simulation' AND (NEW.activity_metadata->>'score')::decimal >= 80 THEN
        INSERT INTO public.feed_items (user_id, type, content)
        VALUES (NEW.user_id, 'achievement', jsonb_build_object(
            'title', 'Ação Heroica!', 
            'body', 'Acabou de realizar um simulado com pontuação incrível.',
            'score', NEW.activity_metadata->>'score'
        ));
    ELSIF NEW.activity_type = 'streak_milestone' THEN
        INSERT INTO public.feed_items (user_id, type, content)
        VALUES (NEW.user_id, 'streak', jsonb_build_object(
            'title', 'Chama Acesa!',
            'body', 'Bateu a meta de ' || (NEW.activity_metadata->>'days') || ' dias seguidos!',
            'days', NEW.activity_metadata->>'days'
        ));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_activity_to_feed ON public.activity_logs;
CREATE TRIGGER trigger_activity_to_feed
    AFTER INSERT ON public.activity_logs
    FOR EACH ROW EXECUTE FUNCTION public.create_feed_item_from_activity();
