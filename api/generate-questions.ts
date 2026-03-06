import { GoogleGenAI, Type } from '@google/genai';
import { buildQuestionsPrompt, defaultGeminiModel } from '../src/lib/gemini-config';

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

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo nao permitido.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const modelName = process.env.GEMINI_MODEL || defaultGeminiModel;

  if (!apiKey) {
    return res.status(500).json({
      error: 'GEMINI_API_KEY nao configurada no servidor.',
    });
  }

  const { area, topic, count, difficulty, rawContent } = req.body || {};

  if (!area || !topic || !count || !difficulty) {
    return res.status(400).json({
      error: 'Parametros obrigatorios ausentes para gerar questoes.',
    });
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: buildQuestionsPrompt({
        area,
        topic,
        count,
        difficulty,
        rawContent: rawContent || '',
      }),
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
      return res.status(502).json({ error: 'O Gemini respondeu sem corpo de texto.' });
    }

    return res.status(200).json(JSON.parse(response.text));
  } catch (error) {
    const message = getErrorMessage(error);
    console.error('Error generating questions with Gemini:', error);
    return res.status(500).json({ error: message });
  }
}
