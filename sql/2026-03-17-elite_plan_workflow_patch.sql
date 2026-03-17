-- Patch: estados formais do plano Elite + trilha de revisoes
-- Idempotente

ALTER TABLE elite_study_plans
    ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'template',
    ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;

ALTER TABLE elite_study_plans
    ALTER COLUMN status SET DEFAULT 'draft';

CREATE TABLE IF NOT EXISTS elite_plan_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES elite_study_plans(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    event_type VARCHAR(30) NOT NULL,
    actor_role VARCHAR(20) DEFAULT 'student',
    previous_status VARCHAR(20),
    new_status VARCHAR(20),
    change_summary TEXT,
    snapshot JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_elite_plan_revisions_plan_id ON elite_plan_revisions(plan_id);
CREATE INDEX IF NOT EXISTS idx_elite_plan_revisions_user_id ON elite_plan_revisions(user_id);
CREATE INDEX IF NOT EXISTS idx_elite_plan_revisions_created_at ON elite_plan_revisions(created_at DESC);

WITH ranked_current_plans AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY user_id
            ORDER BY COALESCE(updated_at, created_at) DESC, created_at DESC
        ) AS row_num
    FROM elite_study_plans
    WHERE status IN ('draft', 'finalized', 'active')
)
UPDATE elite_study_plans AS plans
SET
    status = 'archived',
    status_changed_at = NOW(),
    updated_at = NOW()
FROM ranked_current_plans AS ranked
WHERE plans.id = ranked.id
  AND ranked.row_num > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_elite_current_plan_per_user
ON elite_study_plans(user_id)
WHERE status IN ('draft', 'finalized', 'active');

ALTER TABLE elite_plan_revisions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'elite_plan_revisions'
          AND policyname = 'Users can view own plan revisions'
    ) THEN
        CREATE POLICY "Users can view own plan revisions"
        ON elite_plan_revisions FOR SELECT
        USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'elite_plan_revisions'
          AND policyname = 'Users can insert own plan revisions'
    ) THEN
        CREATE POLICY "Users can insert own plan revisions"
        ON elite_plan_revisions FOR INSERT
        WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'elite_plan_revisions'
          AND policyname = 'Admins can view all plan revisions'
    ) THEN
        CREATE POLICY "Admins can view all plan revisions"
        ON elite_plan_revisions FOR SELECT
        USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
    END IF;
END $$;
