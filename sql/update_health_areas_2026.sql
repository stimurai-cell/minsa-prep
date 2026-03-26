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
ON CONFLICT (name) DO NOTHING;
