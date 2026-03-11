-- Permissões Adicionais para Administradores (RLS)
-- Permitir que admins vejam todas as tentativas de quiz e logs de atividade

DO $$
BEGIN
    DROP POLICY IF EXISTS "Admins can view all quizzes" ON quiz_attempts;
    DROP POLICY IF EXISTS "Admins can view all activity" ON activity_logs;
END$$;

-- 1. Permitir que admins vejam todas as simulações (quiz_attempts)
CREATE POLICY "Admins can view all quizzes" 
ON quiz_attempts 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- 2. Permitir que admins vejam todos os logs de atividade
CREATE POLICY "Admins can view all activity" 
ON activity_logs 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- NOTA: Os utilizadores comuns continuam a ver apenas os seus próprios dados 
-- através das políticas "Users can view own..." já existentes.
