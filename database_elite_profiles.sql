-- Tabela adicional para perfis Elite com dados pessoais
-- Complementa o sistema Elite existente

-- Tabela de perfis Elite com informações pessoais
CREATE TABLE IF NOT EXISTS elite_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
    daily_study_time VARCHAR(20) NOT NULL CHECK (daily_study_time IN ('LOW', 'MEDIUM', 'HIGH', 'INTENSIVE')),
    exam_experience VARCHAR(20) NOT NULL CHECK (exam_experience IN ('BEGINNER', 'INTERMEDIATE', 'EXPERIENCED')),
    self_declared_weak_area TEXT,
    preferred_study_period VARCHAR(10) NOT NULL CHECK (preferred_study_period IN ('MORNING', 'AFTERNOON', 'EVENING')),
    preferred_study_hour TIME NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de templates de planos predefinidos (fallback)
CREATE TABLE IF NOT EXISTS elite_plan_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    intensity VARCHAR(20) NOT NULL CHECK (intensity IN ('LOW', 'MEDIUM', 'HIGH', 'INTENSIVE')),
    plan_structure JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir templates predefinidos
INSERT INTO elite_plan_templates (name, intensity, plan_structure) VALUES 
('Plano Leve', 'LOW', '{
    "monday": {"type": "training", "time": "20:00", "focus": "Revisão básica"},
    "tuesday": {"type": "rest", "time": null, "focus": null},
    "wednesday": {"type": "practice", "time": "20:00", "focus": "Exercícios leves"},
    "thursday": {"type": "rest", "time": null, "focus": null},
    "friday": {"type": "srs", "time": "20:00", "focus": "Revisão SRS"},
    "saturday": {"type": "rest", "time": null, "focus": null},
    "sunday": {"type": "mini_simulation", "time": "20:00", "focus": "Mini simulado"}
}'),

('Plano Equilibrado', 'MEDIUM', '{
    "monday": {"type": "training", "time": "20:00", "focus": "Estudo focado"},
    "tuesday": {"type": "training", "time": "21:00", "focus": "Prática intensiva"},
    "wednesday": {"type": "practice", "time": "20:00", "focus": "Exercícios variados"},
    "thursday": {"type": "srs", "time": "21:00", "focus": "Revisão SRS"},
    "friday": {"type": "practice", "time": "20:00", "focus": "Speed mode"},
    "saturday": {"type": "review", "time": "16:00", "focus": "Revisão semanal"},
    "sunday": {"type": "simulation", "time": "20:00", "focus": "Simulado completo"}
}'),

('Plano Intensivo', 'HIGH', '{
    "monday": {"type": "training", "time": "20:00", "focus": "Estudo intensivo"},
    "tuesday": {"type": "practice", "time": "21:00", "focus": "Prática avançada"},
    "wednesday": {"type": "srs", "time": "20:00", "focus": "Revisão SRS"},
    "thursday": {"type": "practice", "time": "21:00", "focus": "Speed mode"},
    "friday": {"type": "training", "time": "20:00", "focus": "Estudo focado"},
    "saturday": {"type": "review", "time": "16:00", "focus": "Revisão completa"},
    "sunday": {"type": "simulation", "time": "20:00", "focus": "Simulado completo"}
}'),

('Plano Super Intensivo', 'INTENSIVE', '{
    "monday": {"type": "training", "time": "20:00", "focus": "Estudo super intensivo"},
    "tuesday": {"type": "practice", "time": "21:00", "focus": "Prática expert"},
    "wednesday": {"type": "srs", "time": "20:00", "focus": "Revisão SRS"},
    "thursday": {"type": "practice", "time": "21:00", "focus": "Speed mode avançado"},
    "friday": {"type": "training", "time": "20:00", "focus": "Estudo focado"},
    "saturday": {"type": "review", "time": "14:00", "focus": "Revisão detalhada"},
    "sunday": {"type": "simulation", "time": "20:00", "focus": "Simulado completo"}
}')
ON CONFLICT DO NOTHING;

-- Índices
CREATE INDEX IF NOT EXISTS idx_elite_profiles_user_id ON elite_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_elite_profiles_study_time ON elite_profiles(daily_study_time);
CREATE INDEX IF NOT EXISTS idx_elite_profiles_experience ON elite_profiles(exam_experience);
CREATE INDEX IF NOT EXISTS idx_elite_templates_intensity ON elite_plan_templates(intensity);

-- RLS
ALTER TABLE elite_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE elite_plan_templates ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para elite_profiles
CREATE POLICY "Users can view own elite profile" ON elite_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own elite profile" ON elite_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own elite profile" ON elite_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all elite profiles" ON elite_profiles FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Políticas RLS para templates (todos podem ver, apenas admin altera)
CREATE POLICY "Everyone can view active templates" ON elite_plan_templates FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Admins can manage templates" ON elite_plan_templates FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Trigger para updated_at
CREATE TRIGGER update_elite_profiles_updated_at 
BEFORE UPDATE ON elite_profiles 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comentários
COMMENT ON TABLE elite_profiles IS 'Dados pessoais de usuários Elite para personalização de planos';
COMMENT ON TABLE elite_plan_templates IS 'Templates de planos predefinidos como fallback';
