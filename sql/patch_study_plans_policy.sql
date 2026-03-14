-- Habilita RLS e cria políticas para o utilizador ler/gravar o seu plano
-- Seguro para rodar no editor SQL do Supabase.

ALTER TABLE public.study_plans ENABLE ROW LEVEL SECURITY;

-- SELECT: cada utilizador só vê o próprio plano
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE polname = 'study_plans_select_own'
      AND tablename = 'study_plans'
  ) THEN
    CREATE POLICY study_plans_select_own
      ON public.study_plans
      FOR SELECT
      USING (user_id = auth.uid());
  END IF;
END $$;

-- INSERT: só pode inserir plano para si mesmo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE polname = 'study_plans_insert_own'
      AND tablename = 'study_plans'
  ) THEN
    CREATE POLICY study_plans_insert_own
      ON public.study_plans
      FOR INSERT
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- UPDATE: só pode alterar o próprio plano
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE polname = 'study_plans_update_own'
      AND tablename = 'study_plans'
  ) THEN
    CREATE POLICY study_plans_update_own
      ON public.study_plans
      FOR UPDATE
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Opcional: DELETE bloqueado por omissão (mais seguro). Se quiser permitir:
-- CREATE POLICY study_plans_delete_own ON public.study_plans FOR DELETE USING (user_id = auth.uid());

