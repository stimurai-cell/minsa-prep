BEGIN;

ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS active_packages TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE public.profiles
SET active_packages = ARRAY[]::TEXT[]
WHERE active_packages IS NULL;

COMMENT ON COLUMN public.profiles.active_packages IS
  'Pacotes extras ativos do utilizador, mantidos separados do role principal.';

COMMIT;
