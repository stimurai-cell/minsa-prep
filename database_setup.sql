-- MINSA Prep - Database Schema & Initial Data (Ultra-Robust & Consolidated Version)
-- Versão Consolidada: Fevereiro/Março 2025
-- Este arquivo unifica TODAS as funcionalidades: Core, Ligas, Social, SRS, Duelos, Mentor IA, Notificações e Admin.

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. CREATE TYPES
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('free', 'basic', 'premium', 'elite', 'admin');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'difficulty_level') THEN
        CREATE TYPE difficulty_level AS ENUM ('easy', 'medium', 'hard');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_request_status') THEN
        CREATE TYPE payment_request_status AS ENUM ('pending', 'approved', 'rejected');
    END IF;
END$$;

-- 3. CORE TABLES
CREATE TABLE IF NOT EXISTS public.areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE IF NOT EXISTS public.topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id UUID REFERENCES public.areas(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(area_id, name)
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  full_name TEXT NOT NULL,
  student_number TEXT,
  phone TEXT,
  role user_role DEFAULT 'free',
  selected_area_id UUID REFERENCES public.areas(id),
  preparation_time_months INT DEFAULT 1,
  total_xp INT DEFAULT 0,
  goal TEXT,
  avatar_style TEXT DEFAULT 'default',
  avatar_url TEXT,
  current_league TEXT DEFAULT 'Bronze',
  streak_freeze_active BOOLEAN DEFAULT FALSE,
  last_streak_freeze_at TIMESTAMP WITH TIME ZONE,
  streak_count INT DEFAULT 0,
  last_active TIMESTAMP WITH TIME ZONE,
  is_public BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 4. CONTENT TABLES
CREATE TABLE IF NOT EXISTS public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  difficulty difficulty_level DEFAULT 'medium',
  exam_year INT,
  is_contest_highlight BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE IF NOT EXISTS public.alternatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_correct BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE IF NOT EXISTS public.question_explanations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE UNIQUE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 5. ACTIVITY AND GAMIFICATION
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL, 
  activity_date DATE DEFAULT CURRENT_DATE,
  activity_metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs (created_at DESC);

CREATE TABLE IF NOT EXISTS public.weekly_league_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    league_name TEXT DEFAULT 'Bronze',
    xp_earned INTEGER DEFAULT 0,
    week_start_date DATE DEFAULT CURRENT_DATE,
    UNIQUE(user_id, week_start_date)
);

CREATE TABLE IF NOT EXISTS public.user_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL, -- 'achievement', 'goal_reached', 'level_up', 'streak_day', 'exam_passed'
  content TEXT, -- Flexible content
  description TEXT,
  xp_earned INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE IF NOT EXISTS public.badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  icon_url TEXT,
  criteria_type TEXT NOT NULL, -- streak, score, count, time
  criteria_value INT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE IF NOT EXISTS public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_id UUID REFERENCES public.badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(user_id, badge_id)
);

-- 6. SOCIAL SYSTEM
CREATE TABLE IF NOT EXISTS public.user_follows (
    follower_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    following_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    PRIMARY KEY (follower_id, following_id)
);

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

CREATE TABLE IF NOT EXISTS public.user_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE, -- Null means broadcast
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    type TEXT DEFAULT 'system',
    link TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 7. QUIZ, SRS AND BATTLE
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  area_id UUID REFERENCES public.areas(id) ON DELETE CASCADE,
  score DECIMAL(5,2) DEFAULT 0.00,
  total_questions INT NOT NULL,
  correct_answers INT DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  completed_at TIMESTAMP WITH TIME ZONE,
  is_completed BOOLEAN DEFAULT FALSE,
  package TEXT DEFAULT 'free'
);

CREATE TABLE IF NOT EXISTS public.quiz_attempt_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_attempt_id UUID REFERENCES public.quiz_attempts(id) ON DELETE CASCADE,
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
  selected_alternative_id UUID REFERENCES public.alternatives(id),
  is_correct BOOLEAN NOT NULL,
  answered_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

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

-- 8. ADMINISTRATIVE AND SUPPORT
CREATE TABLE IF NOT EXISTS public.payment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  payer_name TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  plan_name TEXT NOT NULL,
  amount_kwanza INT NOT NULL,
  duration_months INT DEFAULT 1,
  payment_reference TEXT NOT NULL,
  proof_url TEXT NOT NULL,
  proof_storage_path TEXT,
  student_note TEXT,
  admin_notes TEXT,
  status payment_request_status DEFAULT 'pending',
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  problem_type TEXT NOT NULL,
  status TEXT DEFAULT 'open', 
  admin_response TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.ai_mentor_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  advice_text TEXT NOT NULL,
  weakness_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 9. FUNCTIONS & SECURITY HELPERS
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;

CREATE OR REPLACE FUNCTION increment_weekly_xp(p_user_id UUID, p_league_name TEXT, p_week_start DATE, p_xp INTEGER)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.weekly_league_stats (user_id, league_name, week_start_date, xp_earned)
    VALUES (p_user_id, p_league_name, p_week_start, p_xp)
    ON CONFLICT (user_id, week_start_date)
    DO UPDATE SET xp_earned = public.weekly_league_stats.xp_earned + p_xp;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alternatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_explanations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_league_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempt_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_question_srs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.battle_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_mentor_logs ENABLE ROW LEVEL SECURITY;

-- 11. POLICIES (Reset and Apply)
DO $$
BEGIN
    -- Reset all
    EXECUTE (
        SELECT string_agg('DROP POLICY IF EXISTS ' || quote_ident(policyname) || ' ON ' || quote_ident(tablename) || ';', ' ')
        FROM pg_policies WHERE schemaname = 'public'
    );
END$$;

-- PROFILES
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can manage all profiles" ON profiles FOR ALL USING (public.is_current_user_admin());

-- CONTENT (Read public, Write admin)
CREATE POLICY "Public read areas" ON areas FOR SELECT USING (true);
CREATE POLICY "Admins manage areas" ON areas FOR ALL USING (public.is_current_user_admin());

CREATE POLICY "Public read topics" ON topics FOR SELECT USING (true);
CREATE POLICY "Admins manage topics" ON topics FOR ALL USING (public.is_current_user_admin());

CREATE POLICY "Public read questions" ON questions FOR SELECT USING (true);
CREATE POLICY "Admins manage questions" ON questions FOR ALL USING (public.is_current_user_admin());

CREATE POLICY "Public read alternatives" ON alternatives FOR SELECT USING (true);
CREATE POLICY "Admins manage alternatives" ON alternatives FOR ALL USING (public.is_current_user_admin());

-- LEAGUES & STATS
CREATE POLICY "Users can view all league stats" ON weekly_league_stats FOR SELECT USING (true);
CREATE POLICY "Users manage own stats" ON weekly_league_stats FOR ALL USING (auth.uid() = user_id);

-- SOCIAL
CREATE POLICY "Anyone can view follows" ON user_follows FOR SELECT USING (true);
CREATE POLICY "Users manage own follows" ON user_follows FOR ALL USING (auth.uid() = follower_id);

CREATE POLICY "Anyone can view activities" ON user_activities FOR SELECT USING (true);
CREATE POLICY "Users create activities" ON user_activities FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public feed" ON feed_items FOR SELECT USING (true);
CREATE POLICY "Admins manage feed" ON feed_items FOR ALL USING (public.is_current_user_admin());

CREATE POLICY "Authenticated react feed" ON feed_reactions FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Comment feed" ON feed_comments FOR ALL USING (auth.uid() IS NOT NULL);

-- NOTIFICATIONS
CREATE POLICY "Users view own notifications" ON user_notifications FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "Admins manage notifications" ON user_notifications FOR ALL USING (public.is_current_user_admin());

-- SRS & BATTLE
CREATE POLICY "Users own SRS" ON user_question_srs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "View matches" ON battle_matches FOR SELECT USING (auth.uid() = challenger_id OR auth.uid() = opponent_id);

-- 12. TRIGGERS
CREATE OR REPLACE FUNCTION public.create_feed_item_from_activity()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.activity_type = 'completed_simulation' AND (NEW.activity_metadata->>'score')::decimal >= 80 THEN
        INSERT INTO public.feed_items (user_id, type, content)
        VALUES (NEW.user_id, 'achievement', jsonb_build_object('title', 'Ação Heroica!', 'body', 'Acabou de realizar um simulado com pontuação incrível.'));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_activity_to_feed ON public.activity_logs;
CREATE TRIGGER trigger_activity_to_feed AFTER INSERT ON public.activity_logs FOR EACH ROW EXECUTE FUNCTION public.create_feed_item_from_activity();

-- 13. INITIAL SEED
INSERT INTO areas (name, description) VALUES
(U&'Farm\00E1cia', 'Medicamentos, farmacologia, assistencia farmaceutica e uso seguro de terapias.'),
('Enfermagem', 'Cuidados ao paciente, procedimentos, triagem, vigilancia e apoio clinico.'),
('CARREIRA MEDICA', 'Base clinica, raciocinio medico, urgencia, diagnostico e conduta assistencial.'),
('PSICOLOGIA CLINICA', 'Saude mental, avaliacao, intervencao clinica e acompanhamento psicologico.'),
('ANALISES CLINICAS E SAUDE PUBLICA / BIO ANALISES CLINICAS', 'Laboratorio, bioanalises, vigilancia epidemiologica e apoio diagnostico em saude publica.'),
('SISTEMA DE NUTRICAO / NUTRICAO E DIETETICA', 'Nutricao clinica, dietetica, planeamento alimentar e educacao nutricional.'),
('CARDIOPNEUMOLOGIA', 'Avaliacao cardiorrespiratoria, exames funcionais e suporte diagnostico.'),
('FISIOTERAPIA', 'Reabilitacao, funcao motora, terapias fisicas e recuperacao funcional.'),
('ELETROMEDICINA', 'Equipamentos biomedicos, manutencao, seguranca tecnica e apoio tecnologico.'),
('ESTOMATOLOGIA', 'Saude oral, diagnostico, prevencao e abordagem estomatologica.'),
('RADIOLOGIA / IMAGIOLOGIA E RADIOFISICA MEDICA', 'Imagem medica, radioprotecao, imagiologia e radiofisica aplicada a saude.')
ON CONFLICT (name) DO NOTHING;
