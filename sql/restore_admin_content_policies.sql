-- ==========================================================
-- MINSA Prep: Restaurar Políticas de Admin para Conteúdo
-- ==========================================================

-- 1. Garantir que a função de verificação de admin existe e é robusta
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;

-- 2. Limpar políticas antigas para evitar duplicados
DO $$
BEGIN
    -- Areas
    DROP POLICY IF EXISTS "Admins can insert areas" ON areas;
    DROP POLICY IF EXISTS "Admins can update areas" ON areas;
    DROP POLICY IF EXISTS "Admins can delete areas" ON areas;
    
    -- Topics
    DROP POLICY IF EXISTS "Admins can insert topics" ON topics;
    DROP POLICY IF EXISTS "Admins can update topics" ON topics;
    DROP POLICY IF EXISTS "Admins can delete topics" ON topics;
    
    -- Questions
    DROP POLICY IF EXISTS "Admins can insert questions" ON questions;
    DROP POLICY IF EXISTS "Admins can update questions" ON questions;
    DROP POLICY IF EXISTS "Admins can delete questions" ON questions;
    
    -- Alternatives
    DROP POLICY IF EXISTS "Admins can insert alternatives" ON alternatives;
    DROP POLICY IF EXISTS "Admins can update alternatives" ON alternatives;
    DROP POLICY IF EXISTS "Admins can delete alternatives" ON alternatives;
    
    -- Explanations
    DROP POLICY IF EXISTS "Admins can insert explanations" ON question_explanations;
    DROP POLICY IF EXISTS "Admins can update explanations" ON question_explanations;
    DROP POLICY IF EXISTS "Admins can delete explanations" ON question_explanations;
END$$;

-- 3. Aplicar Novas Políticas de Escrita para Admins

-- === AREAS ===
CREATE POLICY "Admins can insert areas" ON areas FOR INSERT TO authenticated WITH CHECK (public.is_current_user_admin());
CREATE POLICY "Admins can update areas" ON areas FOR UPDATE TO authenticated USING (public.is_current_user_admin());
CREATE POLICY "Admins can delete areas" ON areas FOR DELETE TO authenticated USING (public.is_current_user_admin());

-- === TOPICS ===
CREATE POLICY "Admins can insert topics" ON topics FOR INSERT TO authenticated WITH CHECK (public.is_current_user_admin());
CREATE POLICY "Admins can update topics" ON topics FOR UPDATE TO authenticated USING (public.is_current_user_admin());
CREATE POLICY "Admins can delete topics" ON topics FOR DELETE TO authenticated USING (public.is_current_user_admin());

-- === QUESTIONS ===
CREATE POLICY "Admins can insert questions" ON questions FOR INSERT TO authenticated WITH CHECK (public.is_current_user_admin());
CREATE POLICY "Admins can update questions" ON questions FOR UPDATE TO authenticated USING (public.is_current_user_admin());
CREATE POLICY "Admins can delete questions" ON questions FOR DELETE TO authenticated USING (public.is_current_user_admin());

-- === ALTERNATIVES ===
CREATE POLICY "Admins can insert alternatives" ON alternatives FOR INSERT TO authenticated WITH CHECK (public.is_current_user_admin());
CREATE POLICY "Admins can update alternatives" ON alternatives FOR UPDATE TO authenticated USING (public.is_current_user_admin());
CREATE POLICY "Admins can delete alternatives" ON alternatives FOR DELETE TO authenticated USING (public.is_current_user_admin());

-- === EXPLANATIONS ===
CREATE POLICY "Admins can insert explanations" ON question_explanations FOR INSERT TO authenticated WITH CHECK (public.is_current_user_admin());
CREATE POLICY "Admins can update explanations" ON question_explanations FOR UPDATE TO authenticated USING (public.is_current_user_admin());
CREATE POLICY "Admins can delete explanations" ON question_explanations FOR DELETE TO authenticated USING (public.is_current_user_admin());

-- 4. Notificar
-- O sistema agora permitirá que admins criem e modifiquem conteúdo diretamente via App.
