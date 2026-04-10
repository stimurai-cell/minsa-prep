// Base de apoio contextual para evitar trocas factuais recorrentes em Angola.
// Mantemos aqui apenas conceitos em que o projeto tem alta confianca local.

export interface TemporalConcept {
  concept: string;
  validFrom: string;
  validTo?: string;
  replacedBy?: string;
  category: 'orgao' | 'lei' | 'regulamento' | 'processo' | 'outro';
  description: string;
  currentStatus: 'ativo' | 'substituido' | 'revogado' | 'desatualizado';
}

const normalizeLookup = (value: string) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const isGeneralCultureTopic = (value: string) =>
  ['cultura geral', 'conhecimentos gerais', 'general knowledge']
    .some((pattern) => normalizeLookup(value).includes(pattern));

export const temporalKnowledgeBase: TemporalConcept[] = [
  {
    concept: 'ARMED - Agencia Reguladora de Medicamentos e Tecnologias de Saude',
    validFrom: '2024-01-01',
    category: 'orgao',
    description: 'Entidade angolana ligada a regulacao, registo, licenciamento, fiscalizacao, qualidade, eficacia e seguranca de medicamentos e tecnologias de saude.',
    currentStatus: 'ativo',
  },
];

export function validateTemporalConcepts(
  text: string,
  referenceDate: string = new Date().toISOString().split('T')[0]
): {
  isValid: boolean;
  issues: Array<{
    concept: string;
    issue: string;
    suggestion?: string;
    severity: 'error' | 'warning';
  }>;
} {
  const issues: Array<{
    concept: string;
    issue: string;
    suggestion?: string;
    severity: 'error' | 'warning';
  }> = [];

  const normalized = normalizeLookup(text);
  void referenceDate;

  if (normalized.includes('infarmed')) {
    issues.push({
      concept: 'INFARMED',
      issue: 'INFARMED e a autoridade do medicamento em Portugal. Nao deve ser tratada como orgao regulador angolano.',
      suggestion: 'Se o contexto for Angola, confirme se o orgao correto e a ARMED ou outra entidade angolana oficialmente indicada.',
      severity: 'error',
    });
  }

  if (normalized.includes('antiga armed')) {
    issues.push({
      concept: 'ARMED',
      issue: 'ARMED nao deve ser descrita automaticamente como orgao extinto ou antigo sem fonte oficial.',
      suggestion: 'Use a designacao oficial atual do orgao no contexto angolano e confirme em fonte institucional.',
      severity: 'error',
    });
  }

  return {
    isValid: issues.filter((issue) => issue.severity === 'error').length === 0,
    issues,
  };
}

export function getCurrentConcepts(category?: TemporalConcept['category']): TemporalConcept[] {
  return temporalKnowledgeBase.filter((concept) => !category || concept.category === category);
}

export function getContextualPrompt(area: string, topic: string): string {
  const currentDate = new Date().toISOString().split('T')[0];
  const normalizedTopic = normalizeLookup(topic);

  if (isGeneralCultureTopic(topic)) {
    return `

CONTEXTO DE ENQUADRAMENTO - ANGOLA ${currentDate}:
- O topico foi identificado como cultura geral ou conhecimentos gerais.
- Nao transforme o lote num bloco tecnico da area ${area}.
- Priorize conhecimentos gerais de concurso: historia e geografia de Angola, cidadania, lingua portuguesa, actualidade amplamente conhecida e raciocinio basico.
- Evite protocolos clinicos, farmacologia detalhada, normas tecnicas ou jargao especializado sem relacao direta com cultura geral.
`;
  }

  if (normalizedTopic.includes('armed')) {
    return `

CONTEXTO DE ENQUADRAMENTO - ANGOLA ${currentDate}:
- ARMED deve ser tratada como entidade angolana do campo regulatorio de medicamentos e tecnologias de saude.
- Foque em registo, licenciamento, fiscalizacao, qualidade, eficacia e seguranca.
- Nao atribua a ARMED funcoes de gestao operacional de stock, distribuicao logistica direta ou assistencia clinica.
- Nao confunda ARMED com INFARMED, que e a autoridade portuguesa do medicamento.
`;
  }

  return `

CONTEXTO DE ENQUADRAMENTO - ANGOLA ${currentDate}:
- Use apenas conceitos e atribuicoes de que tenha seguranca factual.
- Se o topico contiver sigla, orgao ou entidade especifica, confirme o significado oficial antes de gerar as perguntas.
- Nao misture orgaos de Angola com entidades de outros paises.
`;
}
