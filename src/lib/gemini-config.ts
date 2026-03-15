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
# CONTEXTO
Você é especialista em concursos públicos da área da saúde em Angola (MINSA).

# OBJETIVO
Gerar ${count} questões de múltipla escolha sobre "${topic}" da área "${area}".

# CONTEXTO TEMPORAL ATUAL
${getContextualPrompt(area, topic)}

# PROCESSO OBRIGATÓRIO DE RACIOCÍNIO PARA CADA QUESTÃO:
1. PRIMEIRO determine a resposta correta para a pergunta
2. DEPOIS crie alternativas incorretas plausíveis (distratores)
3. VERIFIQUE se a alternativa marcada como correta realmente está correta
4. VERIFIQUE se todas as outras alternativas estão realmente incorretas
5. SE encontrar erro, corrija antes de retornar

# REGRAS CRÍTICAS DE VALIDAÇÃO:
- NÍVEL DE DIFICULDADE: ${difficulty}
- NÚMERO DE ALTERNATIVAS: ${alternativesCount} (A${alternativesCount === 4 ? ', B, C, D' : ', B, C, D, E'})
- EXATAMENTE UMA alternativa com "isCorrect": true
- DEMAIS alternativas com "isCorrect": false
- Português de Angola correto com acentos e pontuação
- Alternativas incorretas devem ser plausíveis mas definitivamente erradas

# REGRAS CRÍTICAS DE VALIDAÇÃO INTERNA:
Antes de finalizar cada questão, faça esta verificação interna:
1. Identifique qual alternativa está marcada como correta
2. Verifique se essa alternativa realmente responde corretamente à pergunta
3. Verifique se todas as outras alternativas estão realmente incorretas
4. Se encontrar erro, corrija antes de retornar
5. Nunca marque como correta uma alternativa conceitualmente errada

# ESTRUTURA OBRIGATÓRIA:
- Gere exatamente ${count} objetos dentro de "questions"
- Cada objeto deve ter todos os campos obrigatórios
- Não gere menos ou mais questões que o solicitado

# FORMATO JSON EXATO (RETORNAR APENAS ISTO):
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

# IMPORTANTE:
- Retorne APENAS o JSON acima, sem texto adicional
- Verifique internamente cada questão antes de retornar
- Garanta que apenas uma alternativa esteja correta
`;
