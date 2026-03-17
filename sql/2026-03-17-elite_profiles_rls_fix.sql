-- Patch: reparar RLS/policies de elite_profiles e sincronizar area
-- Idempotente

ALTER TABLE public.elite_profiles ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'elite_profiles'
          AND policyname IN (
            'Users can view own elite profile',
            'Users can insert own elite profile',
            'Users can update own elite profile',
            'Admins can view all elite profiles'
          )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.elite_profiles', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "Users can view own elite profile"
ON public.elite_profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own elite profile"
ON public.elite_profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own elite profile"
ON public.elite_profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all elite profiles"
ON public.elite_profiles
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
          AND role = 'admin'
    )
);

GRANT SELECT, INSERT, UPDATE ON public.elite_profiles TO authenticated;

UPDATE public.elite_profiles AS ep
SET selected_area_id = p.selected_area_id
FROM public.profiles AS p
WHERE p.id = ep.user_id
  AND ep.selected_area_id IS NULL
  AND p.selected_area_id IS NOT NULL;

UPDATE public.elite_profiles
SET study_days = ARRAY[
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday'
]::TEXT[]
WHERE study_days IS NULL
   OR cardinality(study_days) = 0;
