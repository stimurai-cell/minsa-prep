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
ESPECIALISTA EM CONCURSOS DE SAÚDE EM ANGOLA
ÁREA: ${area}
TÓPICO: ${topic}
QUANTIDADE: ${count} questões
DIFICULDADE: ${difficulty}
ALTERNATIVAS: ${alternativesCount}

${getContextualPrompt(area, topic)}

PROCESSO OBRIGATÓRIO:
1. Defina a resposta correta primeiro
2. Crie alternativas incorretas plausíveis
3. Verifique se apenas uma alternativa está correta
4. Verifique se as outras estão realmente incorretas

REGRAS:
- Apenas uma alternativa com isCorrect: true
- Demais com isCorrect: false
- Português de Angola correto
- Alternativas plausíveis mas incorretas
- Distribuição equilibrada entre todos os tópicos (exceto cultura geral)
- Para simulados: 100 questões total
- Para treinos: número solicitado

RETORNE APENAS O JSON ABAIXO:
{
  "questions": [
    {
      "question": "Texto da pergunta",
      "alternatives": [
        {"text": "Opção A", "isCorrect": false},
        {"text": "Opção B", "isCorrect": false},
        {"text": "Opção C", "isCorrect": true},
        {"text": "Opção D", "isCorrect": false}${alternativesCount === 5 ? `,
        {"text": "Opção E", "isCorrect": false}` : ''}
      ],
      "explanation": "Explicação detalhada",
      "difficulty": "${difficulty}"
    }
  ]
}
`;
