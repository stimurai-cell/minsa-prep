-- Create Gamification Tables
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

-- Note: RLS policies for gamification tables
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read badges" ON public.badges;
CREATE POLICY "Public read badges" ON public.badges FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users own user_badges" ON public.user_badges;
CREATE POLICY "Users own user_badges" ON public.user_badges FOR ALL USING (auth.uid() = user_id);

-- Seed Gamertification Badges
INSERT INTO public.badges (id, name, description, icon_url, criteria_type, criteria_value) VALUES
    (gen_random_uuid(), 'Primeira Chama', 'Iniciante, alcançou 3 dias de ofensiva!', 'https://res.cloudinary.com/dzvusz0u4/image/upload/v1773321031/bm7sb9jomg14n0rw7qaw.png', 'streak', 3),
    (gen_random_uuid(), 'Foco Inabalável', 'Mestre, alcançou 7 dias de ofensiva!', 'https://res.cloudinary.com/dzvusz0u4/image/upload/v1773321031/bm7sb9jomg14n0rw7qaw.png', 'streak', 7),
    (gen_random_uuid(), 'Chama Olímpica', 'Lendário, alcançou 30 dias de ofensiva!', 'https://res.cloudinary.com/dzvusz0u4/image/upload/v1773321031/bm7sb9jomg14n0rw7qaw.png', 'streak', 30),

    (gen_random_uuid(), 'Explorador Curioso', 'Respondeu corretamente a 50 questões!', 'https://res.cloudinary.com/dzvusz0u4/image/upload/v1773321030/lfzbnkekvx22pqe6ruoy.png', 'count', 50),
    (gen_random_uuid(), 'Máquina de Aprender', 'Respondeu corretamente a 500 questões!', 'https://res.cloudinary.com/dzvusz0u4/image/upload/v1773321030/lfzbnkekvx22pqe6ruoy.png', 'count', 500),
    
    (gen_random_uuid(), 'Corujão', 'Fez uma sessão de estudos depois das 22h!', 'https://res.cloudinary.com/dzvusz0u4/image/upload/v1773321031/enzxeopqwqlqqixvmfmr.png', 'time', 22),
    (gen_random_uuid(), 'Madrugador', 'Começou a estudar antes do sol nascer (5h - 7h)!', 'https://res.cloudinary.com/dzvusz0u4/image/upload/v1773321030/lfzbnkekvx22pqe6ruoy.png', 'time', 5)
ON CONFLICT (name) DO NOTHING;
