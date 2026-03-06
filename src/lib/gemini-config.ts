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
  Voce e um especialista em concursos publicos da area da saude em Angola (MINSA).
  Gere ${count} questoes de multipla escolha sobre o topico "${topic}" da area de "${area}".

  REGRAS CRITICAS:
  1. Use portugues correto com todos os acentos e pontuacao.
  2. Cada questao deve ter exatamente 4 alternativas.
  3. Nao inclua letras como "a.", "b.", "c." ou "d." no texto das alternativas.
  4. O nivel de dificuldade deve ser "${difficulty}".
  5. Baseie-se no seguinte conteudo de referencia (se fornecido):
  ${rawContent}
  6. Varie a posicao da alternativa correta entre as 4 opcoes.

  Retorne apenas um JSON valido seguindo estritamente este formato:
  {
    "questions": [
      {
        "question": "Texto da pergunta",
        "alternatives": [
          {"text": "Texto da alternativa", "isCorrect": false},
          {"text": "Texto da alternativa", "isCorrect": true},
          {"text": "Texto da alternativa", "isCorrect": false},
          {"text": "Texto da alternativa", "isCorrect": false}
        ],
        "explanation": "Explicacao detalhada de por que a alternativa correta e a certa e as outras estao erradas.",
        "difficulty": "${difficulty}"
      }
    ]
  }
`;
