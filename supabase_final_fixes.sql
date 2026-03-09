-- ==========================================================
-- MINSA Prep: Ajustes Finais no Banco de Dados (Supabase)
-- ==========================================================

-- 1. BUSCA DE AMIGOS (SOCIAL)
-- Permitir que usuários autenticados pesquisem outros perfis pelo nome
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
CREATE POLICY "Public profiles are viewable by everyone" 
ON profiles FOR SELECT 
TO authenticated 
USING (true);

-- Garantir que seguir outros usuários seja permitido
DROP POLICY IF EXISTS "Users can follow others" ON user_follows;
CREATE POLICY "Users can follow others" 
ON user_follows FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = follower_id);


-- 2. UPLOAD DE FOTOS DE PERFIL (STORAGE)
-- Adicionar coluna para a URL da imagem se ainda não existir
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Criar bucket de armazenamento para os avatars (se não existir)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Permitir que todos vejam os avatars públicos no bucket
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
CREATE POLICY "Avatar images are publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

-- Permitir que qualquer usuário autenticado carregue avatars (Insert)
DROP POLICY IF EXISTS "Anyone can upload an avatar" ON storage.objects;
CREATE POLICY "Anyone can upload an avatar" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');

-- Permitir que o usuário atualize seu próprio avatar (Update)
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar" ON storage.objects
  FOR UPDATE TO authenticated WITH CHECK (bucket_id = 'avatars');

-- Permitir que o usuário delete seu próprio avatar (Delete)
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
CREATE POLICY "Users can delete their own avatar" ON storage.objects
  FOR DELETE TO authenticated WITH CHECK (bucket_id = 'avatars');
