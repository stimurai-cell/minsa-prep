import { validateTemporalConcepts, getContextualPrompt } from './temporalValidation';

export interface GenerateQuestionsPayload {
  area: string;
  topic: string;
  count: number;
  difficulty: string;
  rawContent: string;
  alternativesCount: number;
}

export const defaultGeminiModel = 'gemini-2.5-flash';

export const buildQuestionsPrompt = ({
  area,
  topic,
  count,
  difficulty,
  rawContent,
  alternativesCount,
}: GenerateQuestionsPayload) => `
  Voce e um especialista em concursos publicos da area da saude em Angola (MINSA).
  Gere ${count} questoes de multipla escolha sobre o topico "${topic}" da area de "${area}".

  ${getContextualPrompt(area, topic)}

  REGRAS CRITICAS - OBEDECA RIGIDOSAMENTE:
  1. Use portugues correto de Angola com todos os acentos e pontuacao.
  2. Cada questao deve ter exatamente ${alternativesCount} alternativas (A${alternativesCount === 4 ? ', B, C, D' : ', B, C, D, E'}).
  3. Estilo de escrita: Use termos como "assinale a alternativa correta", "assinale a incorreta", "exceto".
  4. O nivel de dificuldade deve ser "${difficulty}".
  5. Baseie-se no seguinte conteudo de referencia (se fornecido):
  ${rawContent || 'Nenhum conteudo fornecido - use seu conhecimento especializado.'}
  
  REGRA MAIS IMPORTANTE - ALTERNATIVAS:
  - EXATAMENTE UMA (1) alternativa deve ter "isCorrect": true
  - TODAS as outras alternativas devem ter "isCorrect": false
  - A alternativa correta deve ser a unica resposta certa para a pergunta
  - As alternativas incorretas devem ser plausiveis mas definitivamente erradas
  
  REGRA CRUCIAL - ATUALIDADE TEMPORAL:
  - USE APENAS conceitos e orgaos ATUAIS listados no contexto temporal
  - NUNCA use orgaos desatualizados como ARMED, Conselho Nacional de Farmácia, etc.
  - Se mencionar conceito antigo, esclareça que foi substituido
  
  EXEMPLO DE QUESTAO CORRETA (usando conceitos atuais):
  {
    "question": "Qual o principal orgao regulador de medicamentos em Angola em 2025?",
    "alternatives": [
      {"text": "Ministerio da Saude", "isCorrect": false},
      {"text": "INFARMED - Autoridade Nacional do Medicamento", "isCorrect": true},
      {"text": "ARMED - Agência Reguladora de Medicamentos", "isCorrect": false},
      {"text": "Direccao Nacional de Farmácia", "isCorrect": false}
    ],
    "explanation": "A INFARMED (Autoridade Nacional do Medicamento e Produtos de Saúde) é o orgao regulador atual, sucedendo a antiga ARMED.",
    "difficulty": "medium"
  }

  Retorne APENAS E EXCLUSIVAMENTE um JSON valido.
  NÃO adicione nenhum texto antes ou depois do JSON.
  NÃO inclua explicações ou comentários.
  A resposta deve começar com { e terminar com }.

  Formato JSON:
  {
    "questions": [
      {
        "question": "Texto da pergunta",
        "alternatives": [
          {"text": "Opcao A", "isCorrect": false},
          {"text": "Opcao B", "isCorrect": false},
          {"text": "Opcao C", "isCorrect": true},
          {"text": "Opcao D", "isCorrect": false}${alternativesCount === 5 ? `,
          {"text": "Opcao E", "isCorrect": false}` : ''}
        ],
        "explanation": "Explicacao detalhada da resposta correta.",
        "difficulty": "${difficulty}"
      }
    ]
  }
`;
