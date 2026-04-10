export type TopicGroundingHint = {
  canonicalLabel: string;
  scopeMode: 'technical' | 'institutional' | 'general_culture' | 'mixed';
  summary: string;
  includeAngles: string[];
  avoidAngles: string[];
  forceValidateWithWeb: boolean;
  requiresAuthoritativeResolution: boolean;
  relaxAreaStrictness: boolean;
};

const normalizeLookup = (value: string) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const GENERAL_CULTURE_PATTERNS = [
  'cultura geral',
  'cultura general',
  'conhecimentos gerais',
  'conhecimento geral',
  'general knowledge',
];

const ARMED_PATTERNS = [
  'armed',
  'agencia reguladora de medicamentos',
  'agencia reguladora de medicamentos e tecnologias de saude',
];

export const isGeneralCultureTopic = (value: string) => {
  const normalized = normalizeLookup(value);
  return GENERAL_CULTURE_PATTERNS.some((pattern) => normalized.includes(pattern));
};

export const hasAcronymTopicSignal = (value: string) =>
  /\b[A-Z]{3,10}\b/.test(String(value || '').trim());

export const resolveTopicGroundingHint = ({
  area,
  topic,
}: {
  area: string;
  topic: string;
}): TopicGroundingHint => {
  const normalizedTopic = normalizeLookup(topic);

  if (ARMED_PATTERNS.some((pattern) => normalizedTopic.includes(pattern))) {
    return {
      canonicalLabel: 'ARMED - Agencia Reguladora de Medicamentos e Tecnologias de Saude (Angola)',
      scopeMode: 'institutional',
      summary: 'Trate ARMED como entidade reguladora angolana ligada ao registo, licenciamento, avaliacao, fiscalizacao, qualidade, eficacia e seguranca de medicamentos e tecnologias de saude.',
      includeAngles: [
        'registo e avaliacao tecnico-administrativa',
        'licenciamento e fiscalizacao regulatoria',
        'qualidade, eficacia e seguranca',
        'controlo regulatorio do sector farmaceutico e das tecnologias de saude',
      ],
      avoidAngles: [
        'gestao operacional de stock hospitalar',
        'distribuicao logistica direta de medicamentos a unidades sanitarias',
        'formacao geral de novos profissionais de saude',
        'atribuicoes clinicas assistenciais',
      ],
      forceValidateWithWeb: true,
      requiresAuthoritativeResolution: true,
      relaxAreaStrictness: false,
    };
  }

  if (isGeneralCultureTopic(topic)) {
    return {
      canonicalLabel: 'Cultura geral de concurso',
      scopeMode: 'general_culture',
      summary: 'Trate o topico como conhecimentos gerais de concurso. Nao force tecnicismo da area declarada quando o topico pedir cultura geral.',
      includeAngles: [
        'historia e geografia de Angola',
        'lingua portuguesa e interpretacao',
        'cidadania e instituicoes publicas',
        'actualidade amplamente conhecida',
        'raciocinio logico e numerico basico',
      ],
      avoidAngles: [
        'protocolos clinicos altamente especificos',
        'farmacologia detalhada',
        'normas tecnicas especializadas da area',
        'equipamentos ou procedimentos muito tecnicos sem relacao com conhecimentos gerais',
      ],
      forceValidateWithWeb: true,
      requiresAuthoritativeResolution: false,
      relaxAreaStrictness: true,
    };
  }

  if (hasAcronymTopicSignal(topic)) {
    return {
      canonicalLabel: String(topic || '').trim(),
      scopeMode: 'mixed',
      summary: `O topico parece incluir uma sigla ou entidade especifica. Resolva primeiro o significado oficial no contexto de ${area || 'Angola'} antes de gerar perguntas.`,
      includeAngles: [
        'definicao oficial correta da sigla ou entidade',
        'atribuicoes reais confirmadas em fonte institucional',
        'terminologia usada pelo orgao ou norma oficial',
      ],
      avoidAngles: [
        'expansoes inventadas da sigla',
        'atribuicoes inferidas apenas por senso comum',
        'mistura com entidades de outros paises sem evidencia',
      ],
      forceValidateWithWeb: true,
      requiresAuthoritativeResolution: true,
      relaxAreaStrictness: false,
    };
  }

  return {
    canonicalLabel: String(topic || '').trim() || 'Topico declarado',
    scopeMode: 'technical',
    summary: 'Mantenha aderencia direta ao topico declarado e a area alvo, sem inventar atribuicoes, conceitos ou enquadramentos.',
    includeAngles: [],
    avoidAngles: [],
    forceValidateWithWeb: false,
    requiresAuthoritativeResolution: false,
    relaxAreaStrictness: false,
  };
};

export const buildTopicGroundingPromptSection = ({
  area,
  topic,
  validateWithWeb,
}: {
  area: string;
  topic: string;
  validateWithWeb: boolean;
}) => {
  const hint = resolveTopicGroundingHint({ area, topic });
  const lines = [
    'ENQUADRAMENTO DO TOPICO:',
    `- Rotulo canonico: ${hint.canonicalLabel}`,
    `- Modo de enquadramento: ${hint.scopeMode}`,
    `- Escopo factual: ${hint.summary}`,
  ];

  if (hint.includeAngles.length) {
    lines.push(`- Priorize: ${hint.includeAngles.join('; ')}.`);
  }

  if (hint.avoidAngles.length) {
    lines.push(`- Evite: ${hint.avoidAngles.join('; ')}.`);
  }

  if (validateWithWeb && hint.requiresAuthoritativeResolution) {
    lines.push('- Antes de criar as perguntas, confirme o significado exacto e as atribuicoes do topico em fonte oficial ou institucional angolana.');
  }

  if (hint.scopeMode === 'general_culture') {
    lines.push('- Em cultura geral, nao transforme o lote num bloco tecnico da area. O topico deve continuar amplo e de conhecimentos gerais.');
  }

  return {
    hint,
    section: lines.join('\n'),
  };
};
