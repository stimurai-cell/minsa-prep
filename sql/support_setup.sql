-- SCRIPT PARA CRIAR TABELA DE SUPORTE
-- RODAR NO SQL EDITOR DO SUPABASE

CREATE TABLE IF NOT EXISTS support_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  problem_type TEXT NOT NULL,
  status TEXT DEFAULT 'open', -- 'open', 'in_progress', 'resolved'
  admin_response TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

-- Habilitar RLS
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

-- Usuários podem inserir suas próprias mensagens
CREATE POLICY "Users can insert support messages"
ON support_messages FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Admins podem ver tudo
CREATE POLICY "Admins can view support messages"
ON support_messages FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Admins podem atualizar (responder/mudar status)
CREATE POLICY "Admins can update support messages"
ON support_messages FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);
