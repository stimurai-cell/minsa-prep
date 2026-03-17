-- Elite Package Database Setup (idempotente)
-- Tabelas necessárias para o funcionamento do pacote Elite

-- 1. Controle de Onboarding Elite
CREATE TABLE IF NOT EXISTS elite_onboarding (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- 2. Avaliações Personalizadas Elite
CREATE TABLE IF NOT EXISTS elite_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    assessment_type VARCHAR(50) DEFAULT 'initial', -- 'initial', 'weekly', 'custom'
    total_questions INTEGER DEFAULT 0,
    correct_answers INTEGER DEFAULT 0,
    score INTEGER DEFAULT 0, -- percentage
    duration_seconds INTEGER DEFAULT 0,
    weak_topics TEXT[] DEFAULT '{}',
    strong_topics TEXT[] DEFAULT '{}',
    recommendations TEXT[] DEFAULT '{}',
    question_data JSONB, -- dados detalhados das questões
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Planos de Estudo Semanais
CREATE TABLE IF NOT EXISTS elite_study_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    week_start TIMESTAMPTZ NOT NULL,
    week_end TIMESTAMPTZ NOT NULL,
    daily_plan JSONB NOT NULL, -- estrutura com atividades diárias
    focus_topics TEXT[] DEFAULT '{}',
    source VARCHAR(50) DEFAULT 'template', -- origem do plano (template, personalized, confirmed_by_student)
    status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'finalized', 'active', 'completed', 'archived'
    performance JSONB, -- métricas de desempenho da semana
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    status_changed_at TIMESTAMPTZ DEFAULT NOW(),
    finalized_at TIMESTAMPTZ,
    activated_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    UNIQUE(user_id, week_start)
);

-- 4. Reavaliações Semanais
CREATE TABLE IF NOT EXISTS elite_reassessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    week_start TIMESTAMPTZ NOT NULL,
    week_end TIMESTAMPTZ NOT NULL,
    total_study_time INTEGER DEFAULT 0, -- minutos
    completed_days INTEGER DEFAULT 0,
    simulation_scores INTEGER[] DEFAULT '{}',
    topic_performance JSONB, -- desempenho por tópico
    improvement_areas TEXT[] DEFAULT '{}',
    strong_areas TEXT[] DEFAULT '{}',
    overall_improvement DECIMAL(5,2) DEFAULT 0, -- percentual de melhoria
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Histórico de Atividades Diárias Elite
CREATE TABLE IF NOT EXISTS elite_daily_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    activity_type VARCHAR(20) NOT NULL, -- 'study', 'simulation', 'planning', 'review'
    focus_topic VARCHAR(255),
    planned_time INTEGER DEFAULT 0, -- minutos planejados
    actual_time INTEGER DEFAULT 0, -- minutos reais
    accuracy DECIMAL(5,2) DEFAULT 0, -- percentual de acerto
    questions_answered INTEGER DEFAULT 0,
    questions_correct INTEGER DEFAULT 0,
    completed BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date, activity_type)
);

-- 6. Insights e Recomendações Elite
CREATE TABLE IF NOT EXISTS elite_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    insight_type VARCHAR(50) NOT NULL, -- 'weakness', 'strength', 'recommendation', 'milestone'
    title VARCHAR(255) NOT NULL,
    description TEXT,
    topic VARCHAR(255),
    priority VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
    actionable BOOLEAN DEFAULT TRUE,
    dismissed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

-- 7. Trilho de revisões do plano Elite
CREATE TABLE IF NOT EXISTS elite_plan_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID REFERENCES elite_study_plans(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    event_type VARCHAR(30) NOT NULL, -- 'created', 'autosave', 'manual_save', 'finalized', 'activated', 'completed', 'archived'
    actor_role VARCHAR(20) DEFAULT 'student',
    previous_status VARCHAR(20),
    new_status VARCHAR(20),
    change_summary TEXT,
    snapshot JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_elite_onboarding_user_id ON elite_onboarding(user_id);
CREATE INDEX IF NOT EXISTS idx_elite_assessments_user_id ON elite_assessments(user_id);
CREATE INDEX IF NOT EXISTS idx_elite_assessments_created_at ON elite_assessments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_elite_study_plans_user_id ON elite_study_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_elite_study_plans_status ON elite_study_plans(status);
CREATE INDEX IF NOT EXISTS idx_elite_study_plans_week_start ON elite_study_plans(week_start);
CREATE UNIQUE INDEX IF NOT EXISTS idx_elite_current_plan_per_user ON elite_study_plans(user_id) WHERE status IN ('draft', 'finalized', 'active');
CREATE INDEX IF NOT EXISTS idx_elite_reassessments_user_id ON elite_reassessments(user_id);
CREATE INDEX IF NOT EXISTS idx_elite_daily_activities_user_id ON elite_daily_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_elite_daily_activities_date ON elite_daily_activities(date DESC);
CREATE INDEX IF NOT EXISTS idx_elite_insights_user_id ON elite_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_elite_insights_priority ON elite_insights(priority);
CREATE INDEX IF NOT EXISTS idx_elite_plan_revisions_plan_id ON elite_plan_revisions(plan_id);
CREATE INDEX IF NOT EXISTS idx_elite_plan_revisions_user_id ON elite_plan_revisions(user_id);
CREATE INDEX IF NOT EXISTS idx_elite_plan_revisions_created_at ON elite_plan_revisions(created_at DESC);

-- Comentários nas tabelas
COMMENT ON TABLE elite_onboarding IS 'Controle de onboarding de usuários Elite';
COMMENT ON TABLE elite_assessments IS 'Avaliações personalizadas para usuários Elite';
COMMENT ON TABLE elite_study_plans IS 'Planos de estudo semanais personalizados';
COMMENT ON TABLE elite_reassessments IS 'Reavaliações semanais automáticas';
COMMENT ON TABLE elite_daily_activities IS 'Registro de atividades diárias Elite';
COMMENT ON TABLE elite_insights IS 'Insights e recomendações inteligentes';
COMMENT ON TABLE elite_plan_revisions IS 'Histórico de revisões e mudanças do plano Elite';

-- ========= RLS / Policies (idempotente) =========

-- Habilita RLS
ALTER TABLE elite_onboarding ENABLE ROW LEVEL SECURITY;
ALTER TABLE elite_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE elite_study_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE elite_reassessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE elite_daily_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE elite_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE elite_plan_revisions ENABLE ROW LEVEL SECURITY;

-- Remove policies antigas se já existirem (evita erro 42710)
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname, tablename
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN ('elite_onboarding','elite_assessments','elite_study_plans','elite_reassessments','elite_daily_activities','elite_insights','elite_plan_revisions')
          AND policyname IN (
            'Users can view own elite data','Users can view own assessments','Users can view own study plans',
            'Users can view own reassessments','Users can view own daily activities','Users can view own insights',
            'Users can view own plan revisions',
            'Users can insert own elite data','Users can insert own assessments','Users can insert own study plans',
            'Users can insert own reassessments','Users can insert own daily activities','Users can insert own insights',
            'Users can insert own plan revisions',
            'Users can update own elite data','Users can update own assessments','Users can update own study plans',
            'Users can update own reassessments','Users can update own daily activities','Users can update own insights',
            'Admins can view all plan revisions',
            'Admins can view all elite data','Admins can view all assessments','Admins can view all study plans',
            'Admins can view all reassessments','Admins can view all daily activities','Admins can view all insights'
          )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
    END LOOP;
END$$;

-- Políticas RLS
-- Usuários podem ver seus próprios dados
CREATE POLICY "Users can view own elite data" ON elite_onboarding FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view own assessments" ON elite_assessments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view own study plans" ON elite_study_plans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view own reassessments" ON elite_reassessments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view own daily activities" ON elite_daily_activities FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view own insights" ON elite_insights FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view own plan revisions" ON elite_plan_revisions FOR SELECT USING (auth.uid() = user_id);

-- Usuários podem inserir seus próprios dados
CREATE POLICY "Users can insert own elite data" ON elite_onboarding FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can insert own assessments" ON elite_assessments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can insert own study plans" ON elite_study_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can insert own reassessments" ON elite_reassessments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can insert own daily activities" ON elite_daily_activities FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can insert own insights" ON elite_insights FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can insert own plan revisions" ON elite_plan_revisions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Usuários podem atualizar seus próprios dados
CREATE POLICY "Users can update own elite data" ON elite_onboarding FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can update own assessments" ON elite_assessments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can update own study plans" ON elite_study_plans FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can update own reassessments" ON elite_reassessments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can update own daily activities" ON elite_daily_activities FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can update own insights" ON elite_insights FOR UPDATE USING (auth.uid() = user_id);

-- Admins podem ver todos os dados Elite
CREATE POLICY "Admins can view all elite data" ON elite_onboarding FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins can view all assessments" ON elite_assessments FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins can view all study plans" ON elite_study_plans FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins can view all reassessments" ON elite_reassessments FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins can view all daily activities" ON elite_daily_activities FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins can view all insights" ON elite_insights FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins can view all plan revisions" ON elite_plan_revisions FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ========= Função/Triggers updated_at =========
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop triggers se já existirem para evitar duplicação
DROP TRIGGER IF EXISTS update_elite_onboarding_updated_at ON elite_onboarding;
DROP TRIGGER IF EXISTS update_elite_study_plans_updated_at ON elite_study_plans;
DROP TRIGGER IF EXISTS update_elite_daily_activities_updated_at ON elite_daily_activities;

CREATE TRIGGER update_elite_onboarding_updated_at BEFORE UPDATE ON elite_onboarding FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_elite_study_plans_updated_at BEFORE UPDATE ON elite_study_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_elite_daily_activities_updated_at BEFORE UPDATE ON elite_daily_activities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========= Tarefas auxiliares =========
-- Função para limpar insights expirados
CREATE OR REPLACE FUNCTION cleanup_expired_insights()
RETURNS void AS $$
BEGIN
    DELETE FROM elite_insights 
    WHERE expires_at IS NOT NULL AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
