-- MINSA Prep: Adicionar coluna de telefone obrigatória
-- Execute este script no SQL Editor do Supabase se a coluna 'phone' ainda não existir.

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS phone TEXT;

-- Tornar obrigatório (Opcional, mas recomendado se quiser consistência total no banco)
-- Nota: Se já houver usuários sem telefone, isto pode falhar. 
-- Melhor manter opcional no banco mas obrigatório no seu código frontend.
-- ALTER TABLE public.profiles ALTER COLUMN phone SET NOT NULL;
