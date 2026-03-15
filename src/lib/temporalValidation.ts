// Base de conhecimento temporal para validação de conceitos em Angola
// Última atualização: 2025

export interface TemporalConcept {
  concept: string;
  validFrom: string; // Data de início da validade
  validTo?: string; // Data de fim da validade (se aplicável)
  replacedBy?: string; // O que substituiu este conceito
  category: 'orgao' | 'lei' | 'regulamento' | 'processo' | 'outro';
  description: string;
  currentStatus: 'ativo' | 'substituido' | 'revogado' | 'desatualizado';
}

export const temporalKnowledgeBase: TemporalConcept[] = [
  // Órgãos Reguladores - Farmácia
  {
    concept: "DNMF - Direção Nacional de Medicamentos e Farmácia",
    validFrom: "2020-01-01",
    category: "orgao",
    description: "Órgão do Ministério da Saúde responsável pela regulação e fiscalização de medicamentos em Angola",
    currentStatus: "ativo"
  },
  {
    concept: "ARMED - Agência Reguladora de Medicamentos",
    validFrom: "2018-01-01",
    validTo: "2019-12-31",
    replacedBy: "DNMF - Direção Nacional de Medicamentos e Farmácia",
    category: "orgao",
    description: "Antiga agência reguladora, substituída pela DNMF",
    currentStatus: "substituido"
  },
  {
    concept: "INFARMED - Autoridade Nacional do Medicamento e Produtos de Saúde",
    validFrom: "2023-06-01",
    category: "orgao",
    description: "Nova designação da autoridade reguladora nacional",
    currentStatus: "ativo"
  },
  
  // Legislação Farmacêutica
  {
    concept: "Lei nº 21/92 - Lei de Bases do Sistema de Saúde",
    validFrom: "1992-01-01",
    validTo: "2023-12-31",
    replacedBy: "Lei nº 3/23 - Lei de Bases do Sistema Nacional de Saúde",
    category: "lei",
    description: "Antiga lei de bases do sistema de saúde",
    currentStatus: "revogado"
  },
  {
    concept: "Lei nº 3/23 - Lei de Bases do Sistema Nacional de Saúde",
    validFrom: "2024-01-01",
    category: "lei",
    description: "Atual lei de bases do sistema de saúde em Angola",
    currentStatus: "ativo"
  },
  {
    concept: "Decreto-Lei nº 89/23 - Regulamento Farmacêutico",
    validFrom: "2023-11-01",
    category: "regulamento",
    description: "Novo regulamento farmacêutico que atualiza as disposições anteriores",
    currentStatus: "ativo"
  },
  
  // Ordens Profissionais
  {
    concept: "OFA - Ordem dos Farmacêuticos de Angola",
    validFrom: "2019-01-01",
    category: "orgao",
    description: "Ordem profissional representante dos farmacêuticos em Angola",
    currentStatus: "ativo"
  },
  {
    concept: "Conselho Nacional de Farmácia",
    validFrom: "2000-01-01",
    validTo: "2018-12-31",
    replacedBy: "OFA - Ordem dos Farmacêuticos de Angola",
    category: "orgao",
    description: "Antigo conselho profissional, substituído pela OFA",
    currentStatus: "substituido"
  },
  
  // Processos e Procedimentos
  {
    concept: "Registro de Medicamentos via INFARMED",
    validFrom: "2023-06-01",
    category: "processo",
    description: "Processo atual de registro de medicamentos através da INFARMED",
    currentStatus: "ativo"
  },
  {
    concept: "Registro de Medicamentos via ARMED",
    validFrom: "2018-01-01",
    validTo: "2023-05-31",
    replacedBy: "Registro de Medicamentos via INFARMED",
    category: "processo",
    description: "Processo antigo de registro via ARMED",
    currentStatus: "substituido"
  },
  
  // Enfermagem
  {
    concept: "OE - Ordem dos Enfermeiros",
    validFrom: "2020-01-01",
    category: "orgao",
    description: "Ordem profissional representante dos enfermeiros em Angola",
    currentStatus: "ativo"
  },
  {
    concept: "Conselho Nacional de Enfermagem",
    validFrom: "1995-01-01",
    validTo: "2019-12-31",
    replacedBy: "OE - Ordem dos Enfermeiros",
    category: "orgao",
    description: "Antigo conselho de enfermagem",
    currentStatus: "substituido"
  }
];

export function validateTemporalConcepts(text: string, referenceDate: string = new Date().toISOString().split('T')[0]): {
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
  
  const reference = new Date(referenceDate);
  
  temporalKnowledgeBase.forEach(concept => {
    if (text.toLowerCase().includes(concept.concept.toLowerCase())) {
      const validFrom = new Date(concept.validFrom);
      const validTo = concept.validTo ? new Date(concept.validTo) : null;
      
      // Verifica se o conceito está válido na data de referência
      if (reference < validFrom) {
        issues.push({
          concept: concept.concept,
          issue: `Este conceito ainda não existia na data de referência. Válido a partir de ${concept.validFrom}`,
          suggestion: "Use um conceito contemporâneo ao período",
          severity: "error"
        });
      } else if (validTo && reference > validTo) {
        issues.push({
          concept: concept.concept,
          issue: `Este conceito está ${concept.currentStatus} desde ${concept.validTo}`,
          suggestion: concept.replacedBy ? `Use: ${concept.replacedBy}` : "Verifique o conceito atual",
          severity: concept.currentStatus === 'substituido' ? 'error' : 'warning'
        });
      }
    }
  });
  
  return {
    isValid: issues.filter(i => i.severity === 'error').length === 0,
    issues
  };
}

export function getCurrentConcepts(category?: TemporalConcept['category']): TemporalConcept[] {
  const currentDate = new Date();
  return temporalKnowledgeBase.filter(concept => {
    const validFrom = new Date(concept.validFrom);
    const validTo = concept.validTo ? new Date(concept.validTo) : null;
    const valid = currentDate >= validFrom && (!validTo || currentDate <= validTo);
    return valid && (!category || concept.category === category);
  });
}

export function getContextualPrompt(area: string, topic: string): string {
  const currentDate = new Date().toISOString().split('T')[0];
  const currentOrgaos = getCurrentConcepts('orgao');
  const currentLeis = getCurrentConcepts('lei');
  
  return `

CONTEXTO TEMPORAL CRÍTICO - ANGOLA ${currentDate}:
ESTE É O CONTEXTO ATUAL QUE DEVE USAR OBRIGATORIAMENTE:

Órgãos ATIVOS em ${currentDate}:
${currentOrgaos.map(o => `- ${o.concept}: ${o.description}`).join('\n')}

Legislação VIGENTE em ${currentDate}:
${currentLeis.map(l => `- ${l.concept}: ${l.description}`).join('\n')}

REGRAS DE TEMPORALIDADE - NÃO USE CONCEITOS DESATUALIZADOS:
1. NUNCA mencione ARMED como órgão ativo (foi substituída por DNMF/INFARMED)
2. NUNCA mencione Conselho Nacional de Farmácia (foi substituído por OFA)
3. NUNCA mencione Conselho Nacional de Enfermagem (foi substituído por OE)
4. Use SEMPRE os órgãos e legislações atuais listados acima
5. Se uma pergunta mencionar um conceito antigo, esclareça que foi substituído

EXEMPLOS DE CORREÇÃO:
- ERRADO: "A ARMED é responsável por..."
- CORRETO: "A INFARMED (antiga ARMED) é responsável por..."

- ERRADO: "O Conselho Nacional de Farmácia regulamenta..."
- CORRETO: "A OFA (antigo Conselho Nacional de Farmácia) regulamenta..."

`;
}
