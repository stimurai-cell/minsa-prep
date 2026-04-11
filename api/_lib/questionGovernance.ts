export type GovernanceQuestion = {
  question: string;
  alternatives: Array<{ text: string; isCorrect: boolean }>;
  explanation: string;
  difficulty: string;
};

type GovernanceProfile = {
  aliases: string[];
  specialistTitle: string;
  scope: string;
  keyRisks: string[];
  preferredReferences: string[];
};

const normalizeLookup = (value: string) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const listItems = (items: string[]) => items.map((item) => `- ${item}`).join('\n');

const GOVERNANCE_PROFILES: GovernanceProfile[] = [
  {
    aliases: ['farmacia'],
    specialistTitle: 'farmaceutico hospitalar e farmacologista clinico',
    scope: 'farmacologia, farmacocinetica, interacoes, assistencia farmaceutica e uso seguro de medicamentos.',
    keyRisks: [
      'Confundir medicamento, classe farmacologica ou mecanismo de acao.',
      'Trocar dose, via, contraindicacao ou interacao clinicamente relevante.',
      'Misturar responsabilidade medica e farmaceutica sem enquadramento.',
    ],
    preferredReferences: ['Goodman & Gilman', 'Katzung', 'Remington'],
  },
  {
    aliases: ['enfermagem'],
    specialistTitle: 'enfermeiro especialista em cuidados clinicos e saude publica',
    scope: 'processo de enfermagem, seguranca do doente, procedimentos, triagem, vigilancia e educacao em saude.',
    keyRisks: [
      'Trocar responsabilidade de enfermagem por ato de outra area sem contexto.',
      'Inventar protocolos operacionais ou frequencias de monitorizacao.',
      'Aceitar conduta insegura para o doente.',
    ],
    preferredReferences: ['Potter & Perry', 'Brunner & Suddarth'],
  },
  {
    aliases: ['carreira medica', 'medica', 'medicina'],
    specialistTitle: 'medico assistencial com foco em clinica medica e urgencia',
    scope: 'semiologia, diagnostico, fisiopatologia, urgencia, interpretacao clinica e conduta inicial.',
    keyRisks: [
      'Trocar fisiopatologia, diagnostico diferencial ou conduta imediata.',
      'Usar valores ou protocolos sem fonte confiavel.',
      'Marcar como correta uma alternativa clinicamente inadequada.',
    ],
    preferredReferences: ['Harrison', 'Guyton & Hall', 'Bates'],
  },
  {
    aliases: ['psicologia clinica'],
    specialistTitle: 'psicologo clinico com foco em avaliacao e intervencao',
    scope: 'psicopatologia, entrevista, avaliacao psicologica, tecnicas de intervencao e etica profissional.',
    keyRisks: [
      'Confundir transtornos, criterios ou tecnicas terapeuticas.',
      'Usar linguagem estigmatizante ou nao tecnica.',
      'Misturar psicologia clinica com outras areas sem enquadramento.',
    ],
    preferredReferences: ['DSM-5-TR', 'CID-11', 'Kaplan & Sadock'],
  },
  {
    aliases: ['analises clinicas', 'bio analises clinicas', 'bioanalises clinicas'],
    specialistTitle: 'especialista em patologia clinica, hematologia laboratorial e bioquimica clinica',
    scope: 'hematologia, bioquimica, microbiologia, imunologia, parasitologia, banco de sangue e apoio diagnostico.',
    keyRisks: [
      'Inverter aminoacidos, cadeias, marcadores, unidades, valores de referencia ou etapas do exame.',
      'Colocar tema de outra disciplina em topico laboratorial errado.',
      'Misturar hematologia, parasitologia e saude publica sem aderencia real ao topico.',
    ],
    preferredReferences: ['Henry\'s Clinical Diagnosis', 'Dacie and Lewis', 'Hoffbrand'],
  },
  {
    aliases: ['nutricao', 'dietetica', 'sistema de nutricao'],
    specialistTitle: 'nutricionista clinico e dietista',
    scope: 'avaliacao nutricional, dietoterapia, metabolismo, seguranca alimentar e educacao nutricional.',
    keyRisks: [
      'Confundir dietas terapeuticas, deficiencias e necessidades nutricionais.',
      'Inventar recomendacoes sem base tecnica.',
      'Misturar escopo nutricional com outras areas sem contexto.',
    ],
    preferredReferences: ['Krause', 'Mahan', 'Guyton & Hall'],
  },
  {
    aliases: ['cardiopneumologia'],
    specialistTitle: 'tecnico superior de cardiopneumologia',
    scope: 'fisiologia cardiorrespiratoria, exames funcionais, ECG, espirometria e apoio diagnostico.',
    keyRisks: [
      'Trocar parametros de exames, ondas, volumes ou interpretacoes basicas.',
      'Misturar radiologia ou terapia intensiva sem foco cardiopneumologico.',
      'Aceitar interpretacao tecnicamente imprecisa.',
    ],
    preferredReferences: ['West', 'Braunwald', 'Goldman-Cecil'],
  },
  {
    aliases: ['fisioterapia'],
    specialistTitle: 'fisioterapeuta com foco em reabilitacao funcional',
    scope: 'avaliacao funcional, cinesioterapia, recursos terapeuticos e objetivos de reabilitacao.',
    keyRisks: [
      'Misturar conduta fisioterapeutica com prescricao medica sem contexto.',
      'Definir objetivos terapeuticos incoerentes com a condicao do doente.',
      'Trocar indicacoes e contraindicacoes de recursos fisicos.',
    ],
    preferredReferences: ['Kisner & Colby', 'O\'Sullivan', 'Guyton & Hall'],
  },
  {
    aliases: ['eletromedicina'],
    specialistTitle: 'especialista em eletromedicina e seguranca de equipamentos biomedicos',
    scope: 'manutencao, calibracao, seguranca eletrica, operacao e qualidade de equipamentos medicos.',
    keyRisks: [
      'Confundir manutencao preventiva com corretiva.',
      'Inventar normas tecnicas ou parametros de equipamentos.',
      'Misturar operacao clinica com engenharia sem separar responsabilidades.',
    ],
    preferredReferences: ['Normas IEC aplicaveis', 'Manual do fabricante', 'Boas praticas de engenharia clinica'],
  },
  {
    aliases: ['estomatologia'],
    specialistTitle: 'estomatologista com foco em diagnostico e prevencao oral',
    scope: 'anatomia oral, patologia oral, prevencao, diagnostico e abordagem estomatologica.',
    keyRisks: [
      'Confundir lesoes, anatomia, terminologia e condutas de prevencao.',
      'Misturar estomatologia com outra especialidade sem contexto.',
      'Aceitar mais de uma alternativa correta por excesso de generalidade.',
    ],
    preferredReferences: ['Neville', 'Ten Cate', 'Lindhe'],
  },
  {
    aliases: ['radiologia', 'imagiologia', 'radiofisica medica'],
    specialistTitle: 'especialista em radiologia, imagiologia e radiofisica medica',
    scope: 'formacao de imagem, radioprotecao, modalidades diagnosticas, contraste e seguranca radiologica.',
    keyRisks: [
      'Trocar modalidade indicada, principio fisico ou medida de radioprotecao.',
      'Confundir achado de imagem com conduta de outra area.',
      'Inventar parametros tecnicos ou normas sem base.',
    ],
    preferredReferences: ['Bushberg', 'Bontrager', 'ICRP'],
  },
];

const FALLBACK_PROFILE: GovernanceProfile = {
  aliases: [],
  specialistTitle: 'revisor tecnico senior de concursos da saude',
  scope: 'adequacao tecnico-cientifica, coerencia area-topico, gabarito e explicacao.',
  keyRisks: [
    'Aceitar como correta uma alternativa cientificamente errada.',
    'Misturar area e topico sem aderencia real.',
    'Gerar explicacao sem base bibliografica minima.',
  ],
  preferredReferences: ['Guyton & Hall', 'Harrison'],
};

export const resolveAreaGovernanceProfile = (areaName: string) => {
  const normalized = normalizeLookup(areaName);
  return (
    GOVERNANCE_PROFILES.find((profile) =>
      profile.aliases.some((alias) => normalized.includes(normalizeLookup(alias)))
    ) || FALLBACK_PROFILE
  );
};

export const buildGovernanceReviewPrompt = ({
  area,
  topic,
  sourceMode,
  validateWithWeb,
  topicGroundingNotes,
  formatPlan,
  questions,
}: {
  area: string;
  topic: string;
  sourceMode: string;
  validateWithWeb: boolean;
  topicGroundingNotes: string;
  formatPlan: string;
  questions: GovernanceQuestion[];
}) => {
  const profile = resolveAreaGovernanceProfile(area);

  return `
REVISOR TECNICO FINAL DO MINSA PREP
DATA ATUAL: ${new Date().toISOString().slice(0, 10)}
AREA DECLARADA: ${area}
TOPICO DECLARADO: ${topic}
MODO DE FONTE: ${sourceMode}
VALIDACAO WEB: ${validateWithWeb ? 'ATIVA' : 'DESATIVADA'}
ESPECIALISTA RESPONSAVEL: ${profile.specialistTitle}
ESCOPO TECNICO:
${profile.scope}
${topicGroundingNotes ? `\n${topicGroundingNotes}` : ''}
${formatPlan ? `\nPLANO MINIMO DE VARIEDADE DO LOTE:\n${formatPlan}` : ''}

RISCOS QUE VOCE DEVE CAUCIONAR COM RIGOR:
${listItems(profile.keyRisks)}

REFERENCIAS BASE PREFERIDAS:
${listItems(profile.preferredReferences)}

TAREFA:
- Revise cada questao como um profissional rigoroso desta area.
- Verifique gabarito, precisao cientifica, coerencia da explicacao, adequacao a area e adequacao ao topico.
- Se a questao estiver correta mas a explicacao estiver fraca, reescreva a explicacao.
- Se a questao puder ser corrigida com seguranca, devolva a versao corrigida como approved=true.
- Se nao puder ser salva com seguranca, marque approved=false e explique o motivo em rejection_reason.
- Toda explicacao aprovada deve terminar com base bibliografica curta e confiavel.
- Nunca aprove questao fora da area declarada ou claramente deslocada do topico declarado.
- Nunca aceite inversao de conceitos, cadeias, aminoacidos, unidades, valores ou nomenclatura.
- Preserve o estilo de concurso sem homogeneizar o lote: aceite e mantenha perguntas com "?", comandos como "Assinale a alternativa correta." e afirmacoes terminadas em "Excepto:", "Assinale a falsa:" ou "Assinale a verdadeira:".
- Se o lote estiver demasiado uniforme, reescreva enunciados suficientes para cumprir o plano minimo de variedade, sem mexer no tema central.
- Corrija lotes em que a alternativa correta esteja visualmente maior do que as demais; as opcoes devem ter tamanho e estrutura semelhantes.
- Quando precisar corrigir alternativas, reconstrua o bloco inteiro como um conjunto unico desde a origem, em vez de apenas cortar a correta.
- Reprove e reescreva alternativas quando a correta parecer mais completa, mais especifica ou mais convincente apenas pelo tamanho.
- Pense no ecra movel: a correta nao pode ocupar 2 ou mais linhas a mais do que as outras.
- Preserve 4 alternativas (A-D) e use distratores plausiveis, incluindo erro grafico discreto ou confusao entre norma tecnica e senso comum quando isso melhorar o realismo sem gerar ambiguidade.
- Se o topico for institucional, confira se as atribuicoes mencionadas pertencem mesmo ao orgao certo.
- Se o topico for cultura geral, nao force tecnicismo da area quando isso deturpar o escopo real do topico.

QUESTOES A REVISAR EM JSON:
${JSON.stringify(questions, null, 2)}

RETORNE APENAS JSON PURO NESTE FORMATO:
{
  "reviewer_summary": "Resumo breve da auditoria tecnica aplicada ao lote",
  "questions": [
    {
      "approved": true,
      "question": "Pergunta final",
      "alternatives": [
        { "text": "Opcao A", "isCorrect": false },
        { "text": "Opcao B", "isCorrect": true },
        { "text": "Opcao C", "isCorrect": false },
        { "text": "Opcao D", "isCorrect": false }
      ],
      "explanation": "Explicacao final e tecnicamente segura.",
      "difficulty": "easy|medium|hard",
      "review_notes": ["Nota curta 1", "Nota curta 2"],
      "references": ["Fonte 1", "Fonte 2"],
      "rejection_reason": ""
    }
  ]
}
`;
};

export const sanitizeGovernanceReferences = (value: unknown) => {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((item) => String(item || '').trim())
        .filter(Boolean)
        .slice(0, 3)
    )
  );
};

export const appendGovernanceReferences = (explanation: string, references: string[]) => {
  const cleanExplanation = String(explanation || '').trim();
  if (!cleanExplanation) {
    return references.length ? `Base bibliografica: ${references.join('; ')}.` : '';
  }

  if (!references.length) return cleanExplanation;

  if (normalizeLookup(cleanExplanation).includes('base bibliografica')) {
    return cleanExplanation;
  }

  return `${cleanExplanation}\n\nBase bibliografica: ${references.join('; ')}.`;
};
