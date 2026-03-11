-- Melhoria dos Logs de Atividade para Monitorização Detalhada
-- Remove a agregação por dia e adiciona timestamp e metadados

-- 1. Remover a restrição de unicidade que forçava a agregação por dia
ALTER TABLE activity_logs 
DROP CONSTRAINT IF EXISTS activity_logs_user_id_activity_type_activity_date_key;

-- 2. Adicionar coluna de timestamp preciso (se ainda não existir)
ALTER TABLE activity_logs 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now());

-- 3. Adicionar coluna de metadados para detalhes adicionais (JSONB)
ALTER TABLE activity_logs 
ADD COLUMN IF NOT EXISTS activity_metadata JSONB DEFAULT '{}';

-- 4. Criar um índice para buscas rápidas no admin por data
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs (created_at DESC);

-- NOTA: A coluna activity_date pode ser mantida para compatibilidade, 
-- mas usaremos created_at para ordenação e detalhes de hora.
