-- Tabela para guardar Push Subscriptions dos utilizadores (Web Push VAPID)
-- Executar no Supabase SQL Editor

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    subscription JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, endpoint)
);

-- Índice para lookup rápido por user_id
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);

-- RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Remover políticas se já existirem para evitar erros ao re-executar
DROP POLICY IF EXISTS "Users can manage own push subscriptions" ON push_subscriptions;
DROP POLICY IF EXISTS "Service role can read all push subscriptions" ON push_subscriptions;
DROP POLICY IF EXISTS "Service role can delete expired subscriptions" ON push_subscriptions;

-- Utilizadores só podem ver/gerir as suas próprias subscriptions
CREATE POLICY "Users can manage own push subscriptions"
    ON push_subscriptions
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Service role (backend API) pode ler todas as subscriptions para broadcast
CREATE POLICY "Service role can read all push subscriptions"
    ON push_subscriptions
    FOR SELECT
    USING (auth.role() = 'service_role');

-- Service role pode eliminar subscriptions expiradas
CREATE POLICY "Service role can delete expired subscriptions"
    ON push_subscriptions
    FOR DELETE
    USING (auth.role() = 'service_role');
