-- SCRIPT PARA SUPORTE AO MÓDULO DE CONCURSO PÚBLICO
-- RODAR NO SQL EDITOR DO SUPABASE

-- 1. Adicionar coluna de destaque para concurso nas questões
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='questions' AND column_name='is_contest_highlight') THEN
        ALTER TABLE questions ADD COLUMN is_contest_highlight BOOLEAN DEFAULT false;
    END IF;
END $$;

-- 2. Criar a Área de Legislação e Ética se não existir
-- Nota: O ID será gerado automaticamente. Recomenda-se rodar este insert e verificar o ID gerado.
INSERT INTO areas (name, description)
SELECT 'Legislação, Ética e Deontologia', 'Conteúdo focado nas leis do setor da saúde em Angola e conduta profissional.'
WHERE NOT EXISTS (SELECT 1 FROM areas WHERE name = 'Legislação, Ética e Deontologia');

-- 3. Adicionar uma coluna para o objetivo do estudante (caso ainda não exista na tabela profiles)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='goal') THEN
        ALTER TABLE profiles ADD COLUMN goal TEXT;
    END IF;
END $$;
