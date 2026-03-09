-- MINSA Prep - Database Schema & Initial Data (Ultra-Robust & Consolidated Version)
-- Este arquivo unifica todas as funcionalidades implementadas até agora.

-- 1. Create Types (with existence check)
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

-- 2. Core Tables
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

-- 3. Content Tables
CREATE TABLE IF NOT EXISTS public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  difficulty difficulty_level DEFAULT 'medium',
  exam_year INT,
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

-- 4. Activity and Gamification
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
  activity_type TEXT NOT NULL,
  content TEXT,
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

CREATE TABLE IF NOT EXISTS public.user_follows (
    follower_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    following_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    PRIMARY KEY (follower_id, following_id)
);

-- 5. Quiz and Battle
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

-- 6. Administrative
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_type TEXT NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  end_date TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

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

CREATE TABLE IF NOT EXISTS public.study_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_json JSONB NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
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

-- 7. Functions
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_profile_updates()
RETURNS trigger AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF OLD.id = auth.uid() AND NOT public.is_current_user_admin() THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN RAISE EXCEPTION 'Não pode alterar o cargo do próprio perfil.'; END IF;
    IF OLD.selected_area_id IS NOT NULL AND NEW.selected_area_id IS DISTINCT FROM OLD.selected_area_id THEN
      RAISE EXCEPTION 'A área de estudo fica bloqueada após a primeira definição.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_weekly_xp(p_user_id UUID, p_league_name TEXT, p_week_start DATE, p_xp INTEGER)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.weekly_league_stats (user_id, league_name, week_start_date, xp_earned)
    VALUES (p_user_id, p_league_name, p_week_start, p_xp)
    ON CONFLICT (user_id, week_start_date)
    DO UPDATE SET xp_earned = public.weekly_league_stats.xp_earned + p_xp;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Triggers
DROP TRIGGER IF EXISTS protect_profile_updates_trigger ON public.profiles;
CREATE TRIGGER protect_profile_updates_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_updates();

-- 9. RLS & Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_topic_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempt_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE alternatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_explanations ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_league_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_question_srs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_mentor_logs ENABLE ROW LEVEL SECURITY;

-- Reset policies safely
DO $$
BEGIN
    -- Profiles
    DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
    DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
    DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
    DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
    DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
    DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
    
    -- Leagues
    DROP POLICY IF EXISTS "Users can view all league stats" ON weekly_league_stats;
    DROP POLICY IF EXISTS "Users can update their own weekly stats" ON weekly_league_stats;
    DROP POLICY IF EXISTS "Users can insert their own weekly stats" ON weekly_league_stats;
    
    -- Social
    DROP POLICY IF EXISTS "Anyone can view follows" ON user_follows;
    DROP POLICY IF EXISTS "Users can follow others" ON user_follows;
    DROP POLICY IF EXISTS "Users can unfollow others" ON user_follows;
    DROP POLICY IF EXISTS "Anyone can view activities" ON user_activities;
    DROP POLICY IF EXISTS "Users can create activities" ON user_activities;
    
    -- Support
    DROP POLICY IF EXISTS "Users can insert support messages" ON support_messages;
    DROP POLICY IF EXISTS "Admins can view support messages" ON support_messages;
    DROP POLICY IF EXISTS "Admins can update support messages" ON support_messages;

    -- New Features
    DROP POLICY IF EXISTS "Anyone can view badges" ON badges;
    DROP POLICY IF EXISTS "Users can view own earned badges" ON user_badges;
    DROP POLICY IF EXISTS "Users can view own SRS data" ON user_question_srs;
    DROP POLICY IF EXISTS "Users can update own SRS data" ON user_question_srs;
    DROP POLICY IF EXISTS "Users can view own mentor logs" ON ai_mentor_logs;
END$$;

-- Applying Consolidated Policies
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON profiles FOR SELECT USING (public.is_current_user_admin());
CREATE POLICY "Admins can update all profiles" ON profiles FOR UPDATE USING (public.is_current_user_admin());

CREATE POLICY "Users can view all league stats" ON weekly_league_stats FOR SELECT USING (true);
CREATE POLICY "Users can update their own weekly stats" ON weekly_league_stats FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own weekly stats" ON weekly_league_stats FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can view follows" ON user_follows FOR SELECT USING (true);
CREATE POLICY "Users can follow others" ON user_follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users can unfollow others" ON user_follows FOR DELETE USING (auth.uid() = follower_id);

CREATE POLICY "Anyone can view activities" ON user_activities FOR SELECT USING (true);
CREATE POLICY "Users can create activities" ON user_activities FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert support messages" ON support_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view support messages" ON support_messages FOR SELECT USING (public.is_current_user_admin());
CREATE POLICY "Admins can update support messages" ON support_messages FOR UPDATE USING (public.is_current_user_admin());

CREATE POLICY "Anyone can view badges" ON badges FOR SELECT USING (true);
CREATE POLICY "Users can view own earned badges" ON user_badges FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view own SRS data" ON user_question_srs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own SRS data" ON user_question_srs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can view own mentor logs" ON ai_mentor_logs FOR SELECT USING (auth.uid() = user_id);

-- Core Read Policies
CREATE POLICY "Public read areas" ON areas FOR SELECT USING (true);
CREATE POLICY "Public read topics" ON topics FOR SELECT USING (true);
CREATE POLICY "Public read questions" ON questions FOR SELECT USING (true);
CREATE POLICY "Public read alternatives" ON alternatives FOR SELECT USING (true);
CREATE POLICY "Public read explanations" ON question_explanations FOR SELECT USING (true);

-- 10. Initial Data Seed (Areas & Topics)
INSERT INTO areas (name, description) VALUES
(U&'Farm\00E1cia', U&'\00C1rea focada em medicamentos, farmacologia e assistência farmacêutica.'),
('Enfermagem', U&'\00C1rea focada em cuidados ao paciente, procedimentos e saúde pública.')
ON CONFLICT (name) DO NOTHING;

INSERT INTO topics (area_id, name) 
SELECT id, 'Farmacologia Geral' FROM areas WHERE name = U&'Farm\00E1cia' UNION ALL
SELECT id, U&'Legisla\00E7\00E3o Farmac\00EAutica' FROM areas WHERE name = U&'Farm\00E1cia' UNION ALL
SELECT id, U&'Farm\00E1cia Cl\00EDnica' FROM areas WHERE name = U&'Farm\00E1cia' UNION ALL
SELECT id, U&'Gest\00E3o e Assist\00EAncia Farmac\00EAutica' FROM areas WHERE name = U&'Farm\00E1cia'
ON CONFLICT (area_id, name) DO NOTHING;

INSERT INTO topics (area_id, name) 
SELECT id, 'Anatomia e Fisiologia' FROM areas WHERE name = 'Enfermagem' UNION ALL
SELECT id, U&'Sa\00FAde da Mulher e da Crian\00E7a' FROM areas WHERE name = 'Enfermagem' UNION ALL
SELECT id, U&'\00C9tica e Deontologia' FROM areas WHERE name = 'Enfermagem'
ON CONFLICT (area_id, name) DO NOTHING;

-- Initial Badges
INSERT INTO public.badges (name, description, criteria_type, criteria_value) VALUES
('Corujão', 'Estudou após às 22h.', 'time', 22),
('Madrugador', 'Estudou antes das 7h.', 'time', 7),
('Mestre de Enfermagem', 'Acertou 50 questões de Enfermagem.', 'count', 50),
('Mestre de Farmácia', 'Acertou 50 questões de Farmácia.', 'count', 50),
('Sequência de Fogo', 'Manteve uma sequência de 7 dias.', 'streak', 7)
ON CONFLICT (name) DO NOTHING;
