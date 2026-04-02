ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS streak_count INTEGER NOT NULL DEFAULT 0;

UPDATE public.profiles
SET streak_count = 0
WHERE streak_count IS NULL;

COMMENT ON COLUMN public.profiles.streak_count IS
'Contador atual da ofensiva diaria do utilizador.';
