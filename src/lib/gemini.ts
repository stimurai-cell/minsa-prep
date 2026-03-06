import { GoogleGenAI, Type } from '@google/genai';

const apiKey =
  import.meta.env.VITE_GEMINI_API_KEY ||
  (typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : '') ||
  '';

const modelName =
  import.meta.env.VITE_GEMINI_MODEL ||
  (typeof process !== 'undefined' ? process.env?.GEMINI_MODEL : '') ||
  'gemini-2.5-flash';

const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

const getErrorMessage = (error: unknown) => {
  if (!(error instanceof Error)) {
    return 'Falha desconhecida ao comunicar com o Gemini.';
  }

  const message = error.message;

  if (message.includes('RESOURCE_EXHAUSTED') || message.includes('"code":429')) {
    return 'A chave do Gemini foi encontrada, mas a quota dela acabou ou esse projeto nao tem acesso ao modelo solicitado.';
  }

  if (message.includes('API key') || message.includes('invalid')) {
    return 'A chave do Gemini parece invalida.';
  }

  return message;
};

export const getGeminiConfigStatus = () => ({
  hasApiKey: Boolean(apiKey),
  modelName,
});

export const generateQuestions = async (
  area: string,
  topic: string,
  count: number,
  difficulty: string,
  rawContent: string
) => {
  if (!ai) {
    throw new Error(
      'Chave do Gemini nao encontrada. Use VITE_GEMINI_API_KEY no .env para o frontend local.'
    );
  }

  try {
    const prompt = `
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

    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  alternatives: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        text: { type: Type.STRING },
                        isCorrect: { type: Type.BOOLEAN },
                      },
                      required: ['text', 'isCorrect'],
                    },
                  },
                  explanation: { type: Type.STRING },
                  difficulty: { type: Type.STRING },
                },
                required: ['question', 'alternatives', 'explanation', 'difficulty'],
              },
            },
          },
          required: ['questions'],
        },
      },
    });

    if (!response.text) {
      throw new Error('O Gemini respondeu sem corpo de texto.');
    }

    return JSON.parse(response.text);
  } catch (error) {
    const message = getErrorMessage(error);
    console.error('Error generating questions with Gemini:', error);
    throw new Error(message);
  }
};
