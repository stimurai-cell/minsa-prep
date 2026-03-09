-- MINSA Prep - Database Schema & Initial Data (Ultra-Robust Version)

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

-- Adicionar novos roles se o tipo já existir (safe updates para Supabase)
-- (Pode causar warning se já existirem, mas é seguro ignorar)
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'basic';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'elite';

-- 2. Areas (e.g., Pharmacy, Nursing)
CREATE TABLE IF NOT EXISTS areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Ensure unique index for areas name (required for ON CONFLICT)
CREATE UNIQUE INDEX IF NOT EXISTS areas_name_idx ON areas (name);

-- 3. Topics
CREATE TABLE IF NOT EXISTS topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id UUID REFERENCES areas(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Ensure unique index for topics per area (required for ON CONFLICT)
CREATE UNIQUE INDEX IF NOT EXISTS topics_area_id_name_idx ON topics (area_id, name);

-- 4. Profiles (Extends Supabase Auth Users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  full_name TEXT NOT NULL,
  student_number TEXT,
  role user_role DEFAULT 'free',
  selected_area_id UUID,
  preparation_time_months INT DEFAULT 1,
  total_xp INT DEFAULT 0,
  last_active TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Add constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_selected_area') THEN
        ALTER TABLE profiles ADD CONSTRAINT fk_selected_area FOREIGN KEY (selected_area_id) REFERENCES areas(id);
    END IF;
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'profiles'
          AND column_name = 'total_xp'
    ) THEN
        ALTER TABLE profiles ADD COLUMN total_xp INT DEFAULT 0;
    END IF;
END$$;

-- 5. Questions
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  difficulty difficulty_level DEFAULT 'medium',
  exam_year INT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 6. Alternatives
CREATE TABLE IF NOT EXISTS alternatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_correct BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 7. Question Explanations
CREATE TABLE IF NOT EXISTS question_explanations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE UNIQUE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 8. User Topic Progress (Domain System)
CREATE TABLE IF NOT EXISTS user_topic_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
  domain_score DECIMAL(5,2) DEFAULT 0.00 CHECK (domain_score >= 0 AND domain_score <= 100),
  questions_answered INT DEFAULT 0,
  correct_answers INT DEFAULT 0,
  last_reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(user_id, topic_id)
);

-- 9. Quiz Attempts (Simulados)
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  area_id UUID REFERENCES areas(id) ON DELETE CASCADE,
  score DECIMAL(5,2) DEFAULT 0.00,
  total_questions INT NOT NULL,
  correct_answers INT DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  completed_at TIMESTAMP WITH TIME ZONE,
  is_completed BOOLEAN DEFAULT FALSE,
  package TEXT DEFAULT 'free'
);

-- 10. Quiz Attempt Answers
CREATE TABLE IF NOT EXISTS quiz_attempt_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_attempt_id UUID REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  selected_alternative_id UUID REFERENCES alternatives(id),
  is_correct BOOLEAN NOT NULL,
  answered_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 11. Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  plan_type TEXT NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  end_date TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE IF NOT EXISTS payment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
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

-- 12. Activity Logs
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL, 
  activity_date DATE DEFAULT CURRENT_DATE,
  count INT DEFAULT 1,
  UNIQUE(user_id, activity_type, activity_date)
);

-- 13. Study Plans (generated plans for users)
CREATE TABLE IF NOT EXISTS study_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  plan_json JSONB NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 14. Battle Matches (Modo Batalha XP Plus)
CREATE TABLE IF NOT EXISTS battle_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  opponent_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  area_id UUID REFERENCES areas(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending', -- pending, active, completed, expired
  challenger_score INT DEFAULT 0,
  opponent_score INT DEFAULT 0,
  winner_id UUID REFERENCES profiles(id),
  xp_stake INT DEFAULT 50,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- INITIAL DATA SEEDING
INSERT INTO areas (name, description) VALUES
(U&'Farm\00E1cia', U&'\00C1rea focada em medicamentos, farmacologia e assist\00EAncia farmac\00EAutica.'),
('Enfermagem', U&'\00C1rea focada em cuidados ao paciente, procedimentos e sa\00FAde p\00FAblica.')
ON CONFLICT (name) DO NOTHING;

DO $$
DECLARE
  canonical_farmacia UUID;
  duplicate_topic RECORD;
BEGIN
  SELECT id INTO canonical_farmacia
  FROM areas
  WHERE name = U&'Farm\00E1cia'
  ORDER BY created_at
  LIMIT 1;

  IF canonical_farmacia IS NOT NULL THEN
    FOR duplicate_topic IN
      SELECT duplicate.id AS duplicate_topic_id, canonical.id AS canonical_topic_id
      FROM topics duplicate
      JOIN areas source_area ON source_area.id = duplicate.area_id
      JOIN topics canonical
        ON canonical.name = duplicate.name
       AND canonical.area_id = canonical_farmacia
      WHERE source_area.id <> canonical_farmacia
        AND source_area.name ILIKE 'Farm%'
    LOOP
      UPDATE questions
      SET topic_id = duplicate_topic.canonical_topic_id
      WHERE topic_id = duplicate_topic.duplicate_topic_id;

      UPDATE user_topic_progress
      SET topic_id = duplicate_topic.canonical_topic_id
      WHERE topic_id = duplicate_topic.duplicate_topic_id
        AND NOT EXISTS (
          SELECT 1
          FROM user_topic_progress existing_progress
          WHERE existing_progress.user_id = user_topic_progress.user_id
            AND existing_progress.topic_id = duplicate_topic.canonical_topic_id
        );

      DELETE FROM user_topic_progress
      WHERE topic_id = duplicate_topic.duplicate_topic_id;

      DELETE FROM topics
      WHERE id = duplicate_topic.duplicate_topic_id;
    END LOOP;

    UPDATE topics
    SET area_id = canonical_farmacia
    WHERE area_id IN (
      SELECT id
      FROM areas
      WHERE id <> canonical_farmacia
        AND name ILIKE 'Farm%'
    );

    UPDATE profiles
    SET selected_area_id = canonical_farmacia
    WHERE selected_area_id IN (
      SELECT id
      FROM areas
      WHERE id <> canonical_farmacia
        AND name ILIKE 'Farm%'
    );

    DELETE FROM areas
    WHERE id <> canonical_farmacia
      AND name ILIKE 'Farm%';
  END IF;
END$$;

INSERT INTO areas (name, description) VALUES 
(U&'Farm\00E1cia', U&'\00C1rea focada em medicamentos, farmacologia e assist\00EAncia farmac\00EAutica.'),
('Enfermagem', U&'\00C1rea focada em cuidados ao paciente, procedimentos e sa\00FAde p\00FAblica.')
ON CONFLICT (name) DO NOTHING;

-- Seed Topics for Farmacia
INSERT INTO topics (area_id, name) 
SELECT id, 'Farmacologia Geral' FROM areas WHERE name = U&'Farm\00E1cia'
UNION ALL
SELECT id, U&'Legisla\00E7\00E3o Farmac\00EAutica' FROM areas WHERE name = U&'Farm\00E1cia'
UNION ALL
SELECT id, U&'Farm\00E1cia Cl\00EDnica' FROM areas WHERE name = U&'Farm\00E1cia'
UNION ALL
SELECT id, U&'Gest\00E3o e Assist\00EAncia Farmac\00EAutica' FROM areas WHERE name = U&'Farm\00E1cia'
ON CONFLICT (area_id, name) DO NOTHING;

-- Seed Topics for Enfermagem
INSERT INTO topics (area_id, name) 
SELECT id, 'Anatomia e Fisiologia' FROM areas WHERE name = 'Enfermagem'
UNION ALL
SELECT id, U&'Sa\00FAde da Mulher e da Crian\00E7a' FROM areas WHERE name = 'Enfermagem'
UNION ALL
SELECT id, U&'\00C9tica e Deontologia' FROM areas WHERE name = 'Enfermagem'
ON CONFLICT (area_id, name) DO NOTHING;

-- AUTO-PROFILE TRIGGER
-- Estrategia definitiva:
-- O perfil do estudante passa a ser criado/atualizado pela aplicacao apos o sign up.
-- Mantemos a funcao como no-op apenas para compatibilidade com instalacoes antigas.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_profile_updates()
RETURNS trigger AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.id = auth.uid() AND NOT public.is_current_user_admin() THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Nao pode alterar o cargo do proprio perfil.';
    END IF;

    IF OLD.selected_area_id IS NOT NULL
       AND NEW.selected_area_id IS DISTINCT FROM OLD.selected_area_id THEN
      RAISE EXCEPTION 'A area de estudo fica bloqueada apos a primeira definicao.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- MANUAL FIX FOR EXISTING ADMIN (Run this in SQL Editor if already registered)
-- UPDATE profiles SET role = 'admin' WHERE id IN (SELECT id FROM auth.users WHERE email = 'jossdemo@gmail.com');

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

DROP TRIGGER IF EXISTS protect_profile_updates_trigger ON public.profiles;
CREATE TRIGGER protect_profile_updates_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_updates();

-- RLS POLICIES
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

-- Policies (Drop and recreate to avoid "already exists" errors)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Public read areas" ON areas;
    DROP POLICY IF EXISTS "Public read topics" ON topics;
    DROP POLICY IF EXISTS "Public read questions" ON questions;
    DROP POLICY IF EXISTS "Public read alternatives" ON alternatives;
    DROP POLICY IF EXISTS "Public read explanations" ON question_explanations;
    DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
    DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
    DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
    DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
    DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
    DROP POLICY IF EXISTS "Users can view own progress" ON user_topic_progress;
    DROP POLICY IF EXISTS "Users can insert own progress" ON user_topic_progress;
    DROP POLICY IF EXISTS "Users can update own progress" ON user_topic_progress;
    DROP POLICY IF EXISTS "Users can view own quizzes" ON quiz_attempts;
    DROP POLICY IF EXISTS "Users can insert own quizzes" ON quiz_attempts;
    DROP POLICY IF EXISTS "Users can insert own quiz answers" ON quiz_attempt_answers;
    DROP POLICY IF EXISTS "Users can view own activity" ON activity_logs;
    DROP POLICY IF EXISTS "Users can insert own activity" ON activity_logs;
    DROP POLICY IF EXISTS "Users can view own payment requests" ON payment_requests;
    DROP POLICY IF EXISTS "Users can insert own payment requests" ON payment_requests;
    DROP POLICY IF EXISTS "Admins can view payment requests" ON payment_requests;
    DROP POLICY IF EXISTS "Admins can update payment requests" ON payment_requests;
    DROP POLICY IF EXISTS "Admins can insert areas" ON areas;
    DROP POLICY IF EXISTS "Admins can update areas" ON areas;
    DROP POLICY IF EXISTS "Admins can delete areas" ON areas;
    DROP POLICY IF EXISTS "Admins can insert topics" ON topics;
    DROP POLICY IF EXISTS "Admins can update topics" ON topics;
    DROP POLICY IF EXISTS "Admins can delete topics" ON topics;
    DROP POLICY IF EXISTS "Admins can insert questions" ON questions;
    DROP POLICY IF EXISTS "Admins can update questions" ON questions;
    DROP POLICY IF EXISTS "Admins can delete questions" ON questions;
    DROP POLICY IF EXISTS "Admins can insert alternatives" ON alternatives;
    DROP POLICY IF EXISTS "Admins can update alternatives" ON alternatives;
    DROP POLICY IF EXISTS "Admins can delete alternatives" ON alternatives;
    DROP POLICY IF EXISTS "Admins can insert explanations" ON question_explanations;
    DROP POLICY IF EXISTS "Admins can update explanations" ON question_explanations;
    DROP POLICY IF EXISTS "Admins can delete explanations" ON question_explanations;
END$$;

CREATE POLICY "Public read areas" ON areas FOR SELECT USING (true);
CREATE POLICY "Public read topics" ON topics FOR SELECT USING (true);
CREATE POLICY "Public read questions" ON questions FOR SELECT USING (true);
CREATE POLICY "Public read alternatives" ON alternatives FOR SELECT USING (true);
CREATE POLICY "Public read explanations" ON question_explanations FOR SELECT USING (true);

CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON profiles FOR SELECT USING (public.is_current_user_admin());
CREATE POLICY "Admins can update all profiles" ON profiles FOR UPDATE USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());
CREATE POLICY "Users can view own progress" ON user_topic_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own progress" ON user_topic_progress FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own progress" ON user_topic_progress FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own quizzes" ON quiz_attempts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own quizzes" ON quiz_attempts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can insert own quiz answers"
ON quiz_attempt_answers
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM quiz_attempts
    WHERE quiz_attempts.id = quiz_attempt_answers.quiz_attempt_id
      AND quiz_attempts.user_id = auth.uid()
  )
);
CREATE POLICY "Users can view own activity" ON activity_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own activity" ON activity_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own payment requests" ON payment_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own payment requests" ON payment_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view payment requests" ON payment_requests FOR SELECT USING (public.is_current_user_admin());
CREATE POLICY "Admins can update payment requests" ON payment_requests FOR UPDATE TO authenticated USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());

CREATE POLICY "Admins can insert areas"
ON areas
FOR INSERT
TO authenticated
WITH CHECK (public.is_current_user_admin());

CREATE POLICY "Admins can update areas"
ON areas
FOR UPDATE
TO authenticated
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

CREATE POLICY "Admins can delete areas"
ON areas
FOR DELETE
TO authenticated
USING (public.is_current_user_admin());

CREATE POLICY "Admins can insert topics"
ON topics
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
  )
);

CREATE POLICY "Admins can update topics"
ON topics
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
  )
);

CREATE POLICY "Admins can delete topics"
ON topics
FOR DELETE
TO authenticated
USING (public.is_current_user_admin());

CREATE POLICY "Admins can insert questions"
ON questions
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
  )
);

CREATE POLICY "Admins can update questions"
ON questions
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
  )
);

CREATE POLICY "Admins can delete questions"
ON questions
FOR DELETE
TO authenticated
USING (public.is_current_user_admin());

CREATE POLICY "Admins can insert alternatives"
ON alternatives
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
  )
);

CREATE POLICY "Admins can update alternatives"
ON alternatives
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
  )
);

CREATE POLICY "Admins can delete alternatives"
ON alternatives
FOR DELETE
TO authenticated
USING (public.is_current_user_admin());

CREATE POLICY "Admins can insert explanations"
ON question_explanations
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
  )
);

CREATE POLICY "Admins can delete explanations"
ON question_explanations
FOR DELETE
TO authenticated
USING (public.is_current_user_admin());

CREATE POLICY "Admins can update explanations"
ON question_explanations
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
  )
);

INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can upload payment proofs" ON storage.objects;
END$$;

CREATE POLICY "Users can upload payment proofs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'payment-proofs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
-- NEW QUESTIONS FROM REAL PHARMACY EXAM
DO $$
DECLARE
    topic_id_geral UUID;
    topic_id_gestao UUID;
    topic_id_clinica UUID;
    q_id UUID;
BEGIN
    SELECT id INTO topic_id_geral FROM topics WHERE name = 'Farmacologia Geral' LIMIT 1;
    SELECT id INTO topic_id_gestao FROM topics WHERE name = U&'Gest\00E3o e Assist\00EAncia Farmac\00EAutica' LIMIT 1;
    SELECT id INTO topic_id_clinica FROM topics WHERE name = U&'Farm\00E1cia Cl\00EDnica' LIMIT 1;

    -- Q13
    INSERT INTO questions (topic_id, content, difficulty, exam_year) 
    VALUES (topic_id_geral, '...um efeito farmacologico de accao mais rapida, assinale a verdadeira:', 'easy', 2024)
    RETURNING id INTO q_id;
    INSERT INTO alternatives (question_id, content, is_correct) VALUES
    (q_id, 'Nebulizadores', TRUE),
    (q_id, 'Capsulas', FALSE),
    (q_id, 'Comprimidos', FALSE),
    (q_id, 'Pomadas', FALSE),
    (q_id, 'Supositorios', FALSE);
    INSERT INTO question_explanations (question_id, content) VALUES (q_id, 'Nebulizadores permitem a absorcao direta pelos alveolos pulmonares, garantindo um efeito sistemico ou local muito mais rapido que a via oral ou topica.');

    -- Q14
    INSERT INTO questions (topic_id, content, difficulty, exam_year) 
    VALUES (topic_id_geral, 'Sao formas farmaceuticas, as seguintes afirmacoes, Excepto:', 'easy', 2024)
    RETURNING id INTO q_id;
    INSERT INTO alternatives (question_id, content, is_correct) VALUES
    (q_id, 'Termometros', TRUE),
    (q_id, 'Comprimidos', FALSE),
    (q_id, 'Suspensoes', FALSE),
    (q_id, 'Supositorios', FALSE),
    (q_id, 'Ampolas', FALSE);

    -- Q15
    INSERT INTO questions (topic_id, content, difficulty, exam_year) 
    VALUES (topic_id_gestao, 'O Processo de selecao de medicamentos deve ser, Assinale a falsa:', 'medium', 2024)
    RETURNING id INTO q_id;
    INSERT INTO alternatives (question_id, content, is_correct) VALUES
    (q_id, 'Dinamico', FALSE),
    (q_id, 'Continuo', FALSE),
    (q_id, 'Multidisciplinar', FALSE),
    (q_id, 'Exclusivo dos farmaceuticos', TRUE),
    (q_id, 'Exclusivo dos medicos', FALSE);

    -- Q16
    INSERT INTO questions (topic_id, content, difficulty, exam_year) 
    VALUES (topic_id_gestao, 'Sao condicoes basicas de armazenamento de medicamentos, excepto:', 'medium', 2024)
    RETURNING id INTO q_id;
    INSERT INTO alternatives (question_id, content, is_correct) VALUES
    (q_id, 'Os medicamentos devem ser armazenados sobre estrados ou prateleiras;', FALSE),
    (q_id, 'Os medicamentos devem ser armazenados em locais secos e nao diretamente no chao;', FALSE),
    (q_id, 'Os medicamentos devem ser armazenados e encostados nas paredes para evitar que caiam;', TRUE),
    (q_id, 'Os medicamentos devem ser armazenados em locais que nao receba luz direta do sol;', FALSE),
    (q_id, 'Os medicamentos devem ser armazenados na farmacia central', FALSE);

    -- Q17
    INSERT INTO questions (topic_id, content, difficulty, exam_year) 
    VALUES (topic_id_gestao, 'Sao os elementos e previsao de stock, assinale a falsa:', 'medium', 2024)
    RETURNING id INTO q_id;
    INSERT INTO alternatives (question_id, content, is_correct) VALUES
    (q_id, 'Consumo medio mensal', FALSE),
    (q_id, 'Stock minimo ou de seguranca', FALSE),
    (q_id, 'Tempo de abastecimento ou reposicao', FALSE),
    (q_id, 'Tempo de validade', TRUE),
    (q_id, 'Data de validade', FALSE);

    -- Q18
    INSERT INTO questions (topic_id, content, difficulty, exam_year) 
    VALUES (topic_id_clinica, 'Na gestao farmaceutica tera aprendido o atendimento aos servicos enfermagem em unidose, assinale a verdadeira:', 'medium', 2024)
    RETURNING id INTO q_id;
    INSERT INTO alternatives (question_id, content, is_correct) VALUES
    (q_id, 'Entrega da medicacao para o doente de cada vez que a enfermaria precise', FALSE),
    (q_id, 'Entrega da medicacao para o doente de uma vez a enfermaria', FALSE),
    (q_id, 'Entrega da medicacao para o doente de forma faseada a enfermaria garantir maior eficacia terapeutica', FALSE),
    (q_id, 'Entrega da medicacao para o doente a enfermaria em cada turno nas 24h', TRUE),
    (q_id, 'Criar farmacia satelite nos servicos', FALSE);

    -- Q25
    INSERT INTO questions (topic_id, content, difficulty, exam_year) 
    VALUES (topic_id_clinica, 'Sao objetivos de analise das prescricoes medicas por parte do farmaceutico, excepto:', 'medium', 2024)
    RETURNING id INTO q_id;
    INSERT INTO alternatives (question_id, content, is_correct) VALUES
    (q_id, 'Identificar fatores que possam levar ao aparecimento de reacoes adversas;', FALSE),
    (q_id, 'Melhorar a conduta terapeutica do medico;', FALSE),
    (q_id, 'Modificar as prescricoes medicas', TRUE),
    (q_id, 'Identificar as Interacoes medicamentosa e incompatibilidades', FALSE),
    (q_id, 'Cooperar sempre com a equipe de enfermagem e medica', FALSE);

    -- Q26
    INSERT INTO questions (topic_id, content, difficulty, exam_year) 
    VALUES (topic_id_gestao, 'Criterio a ter em conta para selecionar os medicamentos padronizados de um Hospital, assinale a verdadeira:', 'medium', 2024)
    RETURNING id INTO q_id;
    INSERT INTO alternatives (question_id, content, is_correct) VALUES
    (q_id, 'Selecionar entre medicamentos, os de menor seguranca obtidos nos ensaios clinicos;', FALSE),
    (q_id, 'Entre medicamentos da mesma eficacia, selecionar os de menor indice terapeutica;', FALSE),
    (q_id, 'Entre medicamentos do mesmo grupo selecionar todos de elevada potencia;', FALSE),
    (q_id, 'Selecionar preferentemente medicamentos existentes no mercado internacional.', FALSE),
    (q_id, 'Selecionar os medicamentos tendo em conta o principio ativo', TRUE);

    -- Q27
    INSERT INTO questions (topic_id, content, difficulty, exam_year) 
    VALUES (topic_id_clinica, 'Fatores fundamentais causadores de problemas na farmacoterapia dum hospital, assinale a falsa:', 'medium', 2024)
    RETURNING id INTO q_id;
    INSERT INTO alternatives (question_id, content, is_correct) VALUES
    (q_id, 'Sistemas deficientes de distribuicao e de administracao de medicamentos', FALSE),
    (q_id, 'Aplicacao adequada da informacao do produto no que se refere a sua preparacao e administracao', TRUE),
    (q_id, 'Informacao inadequada do medico prescritor', FALSE),
    (q_id, 'Consumo excessivo do tempo da enfermagem em atividades relacionadas aos medicamentos', FALSE),
    (q_id, 'Qualidade dos profissionais', FALSE);

    -- Q28
    INSERT INTO questions (topic_id, content, difficulty, exam_year) 
    VALUES (topic_id_geral, 'Fatores que influenciam na escolha da via de administracao dos farmacos, assinale a falsa:', 'easy', 2024)
    RETURNING id INTO q_id;
    INSERT INTO alternatives (question_id, content, is_correct) VALUES
    (q_id, 'Estado do paciente', FALSE),
    (q_id, 'Tipo de efeito que se pretende', FALSE),
    (q_id, 'Diminuir a toxicidade', TRUE),
    (q_id, 'Caracteristicas fisico-quimicas do farmaco', FALSE),
    (q_id, 'Diagnostico do doente', FALSE);

    -- Q29
    INSERT INTO questions (topic_id, content, difficulty, exam_year) 
    VALUES (topic_id_gestao, 'O prazo de validade dos medicamentos e um parametro muito importante controlar. Assinale a verdadeira:', 'easy', 2024)
    RETURNING id INTO q_id;
    INSERT INTO alternatives (question_id, content, is_correct) VALUES
    (q_id, 'A data de expiracao indica 5% do principio ativo', FALSE),
    (q_id, 'Apos esta data, o medicamento pode ser utilizado por mais 3 meses', FALSE),
    (q_id, 'Apos esta data, o medicamento pode ser utilizado por mais 1 mes', FALSE),
    (q_id, 'Apos esta data, o medicamento pode ser utilizado com autorizacao do Laboratorio de controlo de qualidade', FALSE),
    (q_id, 'Apos essa data deve-se notificar as inspecoes de saude.', TRUE);

END$$;
