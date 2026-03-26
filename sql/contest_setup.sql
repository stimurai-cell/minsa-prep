-- SCRIPT PARA SUPORTE AO MÓDULO DE CONCURSO PÚBLICO
-- RODAR NO SQL EDITOR DO SUPABASE

-- 1. Adicionar coluna de destaque para concurso nas questões
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='questions' AND column_name='is_contest_highlight') THEN
        ALTER TABLE questions ADD COLUMN is_contest_highlight BOOLEAN DEFAULT false;
    END IF;
END $$;

-- 2. O modulo de concurso usa as mesmas 11 areas oficiais do app.
-- Nao criar uma area separada de legislacao; o reforco do concurso deve viver
-- como topicos, simulados e destaques dentro das areas oficiais.

-- 3. Adicionar uma coluna para o objetivo do estudante (caso ainda não exista na tabela profiles)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='goal') THEN
        ALTER TABLE profiles ADD COLUMN goal TEXT;
    END IF;
END $$;
