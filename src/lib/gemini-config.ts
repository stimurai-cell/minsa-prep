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
}: GenerateQuestionsPayload) => `
  Voce e um especialista em concursos publicos da area da saude em Angola (MINSA).
  Gere ${count} questoes de multipla escolha sobre o topico "${topic}" da area de "${area}".

  REGRAS CRITICAS:
  1. Use portugues correto (Angola) com todos os acentos e pontuacao.
  2. Cada questao deve ter exatamente ${alternativesCount} alternativas (A${alternativesCount === 4 ? ', B, C, D' : ', B, C, D, E'}).
  3. Estilo de escrita: Use termos como "assinale a verdadeira", "assinale a falsa", "Excepto".
  4. O nivel de dificuldade deve ser "${difficulty}".
  5. Baseie-se no seguinte conteudo de referencia (se fornecido):
  ${rawContent}
  
  EXEMPLO DE ESTRUTURA REAL (SIGA ESTE PADRAO):
  Pergunta: "Sao condicoes basicas de armazenamento de medicamentos, excepto:"
  Alianea A: "Os medicamentos devem ser armazenados sobre estrados ou prateleiras;"
  Alianea B: "Os medicamentos devem ser armazenados em locais secos e nao diretamente no chao;"
  Alianea C: "Os medicamentos devem ser armazenados e encostados nas paredes para evitar que caiam;" (Correta pois e falsa)
  ... e assim por diante ate a E.

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
        "explanation": "Explicacao tecnica detalhada.",
        "difficulty": "${difficulty}"
      }
    ]
  }
`;
