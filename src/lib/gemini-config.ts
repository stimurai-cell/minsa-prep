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
INSTRUÇÕES ESSENCIAIS:
1. Você é especialista em concursos públicos da área da saúde em Angola (MINSA).
2. Gere ${count} questões sobre "${topic}" da área "${area}".
3. NÍVEL DE DIFICULDADE: ${difficulty}
4. NÚMERO DE ALTERNATIVAS: ${alternativesCount} (A${alternativesCount === 4 ? ', B, C, D' : ', B, C, D, E'})

${getContextualPrompt(area, topic)}

REGRAS OBRIGATÓRIAS:
- EXATAMENTE UMA alternativa com "isCorrect": true
- DEMAIS alternativas com "isCorrect": false
- Português de Angola correto
- Alternativas plausíveis mas incorretas

FORMATO EXATO (RETORNAR APENAS ISTO):
{
  "questions": [
    {
      "question": "Texto da pergunta aqui",
      "alternatives": [
        {"text": "Opção A", "isCorrect": false},
        {"text": "Opção B", "isCorrect": false},
        {"text": "Opção C", "isCorrect": true},
        {"text": "Opção D", "isCorrect": false}${alternativesCount === 5 ? `,
        {"text": "Opção E", "isCorrect": false}` : ''}
      ],
      "explanation": "Explicação detalhada aqui",
      "difficulty": "${difficulty}"
    }
  ]
}

IMPORTANTE: Retorne APENAS o JSON acima, sem texto adicional.
`;
