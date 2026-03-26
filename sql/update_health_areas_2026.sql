-- MINSA Prep - Atualizacao oficial das areas 2026
-- Mantem o foco comercial atual no Concurso Publico da Saude,
-- mas padroniza as 11 areas oficiais do produto.

INSERT INTO areas (name, description) VALUES
(U&'Farm\00E1cia', 'Medicamentos, farmacologia, assistencia farmaceutica e uso seguro de terapias.'),
('Enfermagem', 'Cuidados ao paciente, procedimentos, triagem, vigilancia e apoio clinico.'),
('CARREIRA MEDICA', 'Base clinica, raciocinio medico, urgencia, diagnostico e conduta assistencial.'),
('PSICOLOGIA CLINICA', 'Saude mental, avaliacao, intervencao clinica e acompanhamento psicologico.'),
('ANALISES CLINICAS E SAUDE PUBLICA / BIO ANALISES CLINICAS', 'Laboratorio, bioanalises, vigilancia epidemiologica e apoio diagnostico em saude publica.'),
('SISTEMA DE NUTRICAO / NUTRICAO E DIETETICA', 'Nutricao clinica, dietetica, planeamento alimentar e educacao nutricional.'),
('CARDIOPNEUMOLOGIA', 'Avaliacao cardiorrespiratoria, exames funcionais e suporte diagnostico.'),
('FISIOTERAPIA', 'Reabilitacao, funcao motora, terapias fisicas e recuperacao funcional.'),
('ELETROMEDICINA', 'Equipamentos biomedicos, manutencao, seguranca tecnica e apoio tecnologico.'),
('ESTOMATOLOGIA', 'Saude oral, diagnostico, prevencao e abordagem estomatologica.'),
('RADIOLOGIA / IMAGIOLOGIA E RADIOFISICA MEDICA', 'Imagem medica, radioprotecao, imagiologia e radiofisica aplicada a saude.')
ON CONFLICT (name) DO UPDATE
SET description = EXCLUDED.description;

DELETE FROM areas
WHERE name = 'CARREIRA MEDICA'
  AND NOT EXISTS (SELECT 1 FROM topics WHERE topics.area_id = areas.id)
  AND NOT EXISTS (SELECT 1 FROM profiles WHERE profiles.selected_area_id = areas.id)
  AND NOT EXISTS (SELECT 1 FROM elite_profiles WHERE elite_profiles.selected_area_id = areas.id)
  AND NOT EXISTS (SELECT 1 FROM quiz_attempts WHERE quiz_attempts.area_id = areas.id)
  AND NOT EXISTS (SELECT 1 FROM questions WHERE questions.area_id = areas.id)
  AND EXISTS (SELECT 1 FROM areas official WHERE official.name = 'CARREIRA MÉDICA');

DELETE FROM areas
WHERE name = 'PSICOLOGIA CLINICA'
  AND NOT EXISTS (SELECT 1 FROM topics WHERE topics.area_id = areas.id)
  AND NOT EXISTS (SELECT 1 FROM profiles WHERE profiles.selected_area_id = areas.id)
  AND NOT EXISTS (SELECT 1 FROM elite_profiles WHERE elite_profiles.selected_area_id = areas.id)
  AND NOT EXISTS (SELECT 1 FROM quiz_attempts WHERE quiz_attempts.area_id = areas.id)
  AND NOT EXISTS (SELECT 1 FROM questions WHERE questions.area_id = areas.id)
  AND EXISTS (SELECT 1 FROM areas official WHERE official.name = 'PSICOLOGIA CLÍNICA');

DELETE FROM areas
WHERE name = 'ANALISES CLINICAS E SAUDE PUBLICA / BIO ANALISES CLINICAS'
  AND NOT EXISTS (SELECT 1 FROM topics WHERE topics.area_id = areas.id)
  AND NOT EXISTS (SELECT 1 FROM profiles WHERE profiles.selected_area_id = areas.id)
  AND NOT EXISTS (SELECT 1 FROM elite_profiles WHERE elite_profiles.selected_area_id = areas.id)
  AND NOT EXISTS (SELECT 1 FROM quiz_attempts WHERE quiz_attempts.area_id = areas.id)
  AND NOT EXISTS (SELECT 1 FROM questions WHERE questions.area_id = areas.id)
  AND EXISTS (SELECT 1 FROM areas official WHERE official.name = 'ANÁLISES CLÍNICAS E SAÚDE PÚBLICA / BIO ANÁLISES CLÍNICAS');

DELETE FROM areas
WHERE name = 'SISTEMA DE NUTRICAO / NUTRICAO E DIETETICA'
  AND NOT EXISTS (SELECT 1 FROM topics WHERE topics.area_id = areas.id)
  AND NOT EXISTS (SELECT 1 FROM profiles WHERE profiles.selected_area_id = areas.id)
  AND NOT EXISTS (SELECT 1 FROM elite_profiles WHERE elite_profiles.selected_area_id = areas.id)
  AND NOT EXISTS (SELECT 1 FROM quiz_attempts WHERE quiz_attempts.area_id = areas.id)
  AND NOT EXISTS (SELECT 1 FROM questions WHERE questions.area_id = areas.id)
  AND EXISTS (SELECT 1 FROM areas official WHERE official.name = 'SISTEMA DE NUTRIÇÃO / NUTRIÇÃO E DIETÉTICA');

DELETE FROM areas
WHERE name = 'RADIOLOGIA / IMAGIOLOGIA E RADIOFISICA MEDICA'
  AND NOT EXISTS (SELECT 1 FROM topics WHERE topics.area_id = areas.id)
  AND NOT EXISTS (SELECT 1 FROM profiles WHERE profiles.selected_area_id = areas.id)
  AND NOT EXISTS (SELECT 1 FROM elite_profiles WHERE elite_profiles.selected_area_id = areas.id)
  AND NOT EXISTS (SELECT 1 FROM quiz_attempts WHERE quiz_attempts.area_id = areas.id)
  AND NOT EXISTS (SELECT 1 FROM questions WHERE questions.area_id = areas.id)
  AND EXISTS (SELECT 1 FROM areas official WHERE official.name = 'RADIOLOGIA / IMAGIOLOGIA E RADIOFÍSICA MÉDICA');
