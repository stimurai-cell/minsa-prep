-- Patch: ajustar elite_profiles para uso do novo wizard Elite
-- Idempotente: safe to run multiple times

ALTER TABLE elite_profiles
    ADD COLUMN IF NOT EXISTS selected_area_id UUID REFERENCES public.areas(id),
    ADD COLUMN IF NOT EXISTS study_days TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_elite_profiles_area ON elite_profiles(selected_area_id);
