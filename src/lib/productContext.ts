export const PRODUCT_CONTEXT = {
  name: 'MINSA Prep',
  vision:
    'Estudar uma quantidade extensa de conteudo de forma facil, inteligente e descontraida.',
  audience:
    'Feito para profissionais e estudantes da saude usarem em diferentes momentos da formacao e da carreira.',
  currentFocus:
    'No momento, o principal foco academico e comercial esta no Concurso Publico da Saude que se aproxima.',
} as const;

export const STUDY_GOALS = [
  'Estudar com mais clareza e constancia',
  'Preparar-me para o concurso da saude',
  'Rever conteudos da minha area no dia a dia',
  'Treinar de forma leve e descontraida',
] as const;

export type HealthAreaCatalogItem = {
  key: string;
  name: string;
  description: string;
  aliases: string[];
};

export const HEALTH_AREAS: HealthAreaCatalogItem[] = [
  {
    key: 'farmacia',
    name: 'Farmácia',
    description: 'Medicamentos, farmacologia, assistencia farmaceutica e uso seguro de terapias.',
    aliases: ['farmacia'],
  },
  {
    key: 'enfermagem',
    name: 'Enfermagem',
    description: 'Cuidados ao paciente, procedimentos, triagem, vigilancia e apoio clinico.',
    aliases: ['enfermagem'],
  },
  {
    key: 'carreira_medica',
    name: 'CARREIRA MÉDICA',
    description: 'Base clinica, raciocinio medico, urgencia, diagnostico e conduta assistencial.',
    aliases: ['carreira medica', 'medicina', 'carreira medica geral'],
  },
  {
    key: 'psicologia_clinica',
    name: 'PSICOLOGIA CLÍNICA',
    description: 'Saude mental, avaliacao, intervencao clinica e acompanhamento psicologico.',
    aliases: ['psicologia clinica'],
  },
  {
    key: 'analises_clinicas_e_saude_publica',
    name: 'ANÁLISES CLÍNICAS E SAÚDE PÚBLICA / BIO ANÁLISES CLÍNICAS',
    description: 'Laboratorio, bioanalises, vigilancia epidemiologica e apoio diagnostico em saude publica.',
    aliases: [
      'analises clinicas e saude publica / bio analises clinicas',
      'analises clinicas e saude publica',
      'bio analises clinicas',
      'bioanalises clinicas',
    ],
  },
  {
    key: 'sistema_de_nutricao',
    name: 'SISTEMA DE NUTRIÇÃO / NUTRIÇÃO E DIETÉTICA',
    description: 'Nutricao clinica, dietetica, planeamento alimentar e educacao nutricional.',
    aliases: [
      'sistema de nutricao / nutricao e dietetica',
      'sistema de nutricao',
      'nutricao e dietetica',
    ],
  },
  {
    key: 'cardiopneumologia',
    name: 'CARDIOPNEUMOLOGIA',
    description: 'Avaliacao cardiorrespiratoria, exames funcionais e suporte diagnostico.',
    aliases: ['cardiopneumologia'],
  },
  {
    key: 'fisioterapia',
    name: 'FISIOTERAPIA',
    description: 'Reabilitacao, funcao motora, terapias fisicas e recuperacao funcional.',
    aliases: ['fisioterapia'],
  },
  {
    key: 'eletromedicina',
    name: 'ELETROMEDICINA',
    description: 'Equipamentos biomedicos, manutencao, seguranca tecnica e apoio tecnologico.',
    aliases: ['eletromedicina'],
  },
  {
    key: 'estomatologia',
    name: 'ESTOMATOLOGIA',
    description: 'Saude oral, diagnostico, prevencao e abordagem estomatologica.',
    aliases: ['estomatologia'],
  },
  {
    key: 'radiologia',
    name: 'RADIOLOGIA / IMAGIOLOGIA E RADIOFÍSICA MÉDICA',
    description: 'Imagem medica, radioprotecao, imagiologia e radiofisica aplicada a saude.',
    aliases: [
      'radiologia / imagiologia e radiofisica medica',
      'radiologia',
      'imagiologia e radiofisica medica',
    ],
  },
] as const;

export const toAreaKey = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .toLowerCase();

const canonicalAreaNameEntries = HEALTH_AREAS.flatMap((area) =>
  [area.name, ...area.aliases].map((label) => [toAreaKey(label), area.name] as const)
);

export const CANONICAL_AREA_NAMES = Object.fromEntries(canonicalAreaNameEntries) as Record<string, string>;

const areaOrder = new Map(HEALTH_AREAS.map((area, index) => [area.name, index]));

export const getCanonicalHealthAreaName = (value: string) =>
  CANONICAL_AREA_NAMES[toAreaKey(value)] || value;

export const isOfficialHealthArea = (value: string) =>
  Boolean(CANONICAL_AREA_NAMES[toAreaKey(value)]);

export const sortAreasByCatalog = <T extends { name: string }>(areas: T[]) =>
  [...areas].sort((left, right) => {
    const leftName = getCanonicalHealthAreaName(left.name);
    const rightName = getCanonicalHealthAreaName(right.name);
    const leftOrder = areaOrder.get(leftName) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = areaOrder.get(rightName) ?? Number.MAX_SAFE_INTEGER;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return leftName.localeCompare(rightName);
  });
