-- ==========================================================
-- MINSA Prep: notificacoes confiaveis, dedupe de push e lembretes inteligentes
-- ==========================================================

CREATE TABLE IF NOT EXISTS public.notification_reads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID NOT NULL REFERENCES public.user_notifications(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(notification_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_reads_user_id
    ON public.notification_reads(user_id, read_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_reads_notification_id
    ON public.notification_reads(notification_id);

ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can manage own notification reads" ON public.notification_reads;
    DROP POLICY IF EXISTS "Admins can inspect notification reads" ON public.notification_reads;
END $$;

CREATE POLICY "Users can manage own notification reads"
    ON public.notification_reads
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can inspect notification reads"
    ON public.notification_reads
    FOR SELECT
    TO authenticated
    USING (public.is_current_user_admin());

ALTER TABLE public.push_subscriptions
    ADD COLUMN IF NOT EXISTS device_id TEXT,
    ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'webpush',
    ADD COLUMN IF NOT EXISTS user_agent TEXT,
    ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW());

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_device_id
    ON public.push_subscriptions(user_id, device_id);

CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_user_device_unique
    ON public.push_subscriptions(user_id, device_id);

CREATE TABLE IF NOT EXISTS public.notification_dispatch_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    channel TEXT NOT NULL DEFAULT 'push',
    kind TEXT NOT NULL,
    dedupe_key TEXT NOT NULL UNIQUE,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_notification_dispatch_logs_user_id
    ON public.notification_dispatch_logs(user_id, created_at DESC);
