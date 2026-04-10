import { validateTemporalConcepts, getContextualPrompt } from './temporalValidation';

export interface GenerateQuestionsPayload {
  area: string;
  topic: string;
  count: number;
  difficulty: string;
  rawContent: string;
}

export const defaultGeminiModel = 'gemini-2.5-flash';

export const buildQuestionsPrompt = ({
  area,
  topic,
  count,
  difficulty,
  rawContent,
}: GenerateQuestionsPayload) => `
ESPECIALISTA EM CONCURSOS DE SAUDE EM ANGOLA
AREA: ${area}
TOPICO: ${topic}
QUANTIDADE: ${count} questoes
DIFICULDADE: ${difficulty}
ALTERNATIVAS: 4

${getContextualPrompt(area, topic)}

PROCESSO OBRIGATORIO:
1. Defina a resposta correta primeiro
2. Crie alternativas incorretas plausiveis
3. Verifique se apenas uma alternativa esta correta
4. Verifique se as outras estao realmente incorretas

REGRAS:
- Apenas uma alternativa com isCorrect: true
- Demais com isCorrect: false
- Portugues de Angola correto
- Alternativas plausiveis mas incorretas
- Mantenha paralelismo sintatico e tamanho visual semelhante entre as alternativas
- A correta nao pode ser obviamente mais extensa, mais completa ou mais detalhada que as outras
- Distribuicao equilibrada entre todos os topicos (exceto cultura geral)
- Para simulados: 100 questoes total
- Para treinos: numero solicitado

RETORNE APENAS O JSON ABAIXO:
{
  "questions": [
    {
      "question": "Texto da pergunta",
      "alternatives": [
        {"text": "Opcao A", "isCorrect": false},
        {"text": "Opcao B", "isCorrect": false},
        {"text": "Opcao C", "isCorrect": true},
        {"text": "Opcao D", "isCorrect": false}
      ],
      "explanation": "Explicacao detalhada",
      "difficulty": "${difficulty}"
    }
  ]
}
`;
