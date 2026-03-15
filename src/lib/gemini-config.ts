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

  REGRAS CRITICAS:
  1. Use portugues correto de Angola com todos os acentos e pontuacao.
  2. Cada questao deve ter exatamente ${alternativesCount} alternativas (A${alternativesCount === 4 ? ', B, C, D' : ', B, C, D, E'}).
  3. Estilo de escrita: Use termos como "assinale a alternativa correta", "assinale a incorreta", "exceto".
  4. O nivel de dificuldade deve ser "${difficulty}".
  5. Baseie-se no seguinte conteudo de referencia (se fornecido):
  ${rawContent || 'Nenhum conteudo fornecido - use seu conhecimento especializado.'}
  
  IMPORTANTE:
  - Apenas UMA alternativa deve estar marcada como correta (isCorrect: true).
  - As demais alternativas devem estar marcadas como incorretas (isCorrect: false).
  - As alternativas incorretas devem ser plausiveis mas definitivamente erradas.
  - A explicacao deve justificar por que a alternativa correta esta certa e as outras estao erradas.

  Retorne apenas um JSON valido seguindo estritamente este formato:
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
