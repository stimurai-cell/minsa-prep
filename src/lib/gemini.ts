import { buildQuestionsPrompt, defaultGeminiModel, type GenerateQuestionsPayload } from './gemini-config';

const localFallbackKey = import.meta.env.VITE_GEMINI_API_KEY || '';
const localFallbackModel = import.meta.env.VITE_GEMINI_MODEL || defaultGeminiModel;

const getErrorMessage = (error: unknown) => {
  if (!(error instanceof Error)) {
    return 'Falha desconhecida ao comunicar com o Gemini.';
  }

  const message = error.message;

  if (message.toLowerCase().includes('reported as leaked')) {
    return 'A chave do Gemini foi bloqueada por vazamento. Gere outra chave e atualize as variaveis GEMINI_API_KEY/VITE_GEMINI_API_KEY.';
  }

  if (message.includes('RESOURCE_EXHAUSTED') || message.includes('"code":429')) {
    return 'A chave do Gemini foi encontrada, mas a quota dela acabou ou esse projeto nao tem acesso ao modelo solicitado.';
  }

  if (message.includes('NOT_FOUND') || (message.toLowerCase().includes('model') && message.toLowerCase().includes('not found'))) {
    return 'O modelo Gemini configurado nao esta disponivel para esta chave. Ajuste GEMINI_MODEL ou use um fallback suportado.';
  }

  if (message.includes('API key') || message.includes('invalid')) {
    return 'A chave do Gemini parece invalida.';
  }

  return message;
};

const generateQuestionsLocally = async (payload: GenerateQuestionsPayload) => {
  const { GoogleGenAI, Type } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: localFallbackKey });

  const response = await ai.models.generateContent({
    model: localFallbackModel,
    contents: buildQuestionsPrompt(payload),
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

  const parsed = JSON.parse(response.text);
  
  // Validate the generated questions
  const validateQuestions = (data: any, expectedAlts: number) => {
    const errors: string[] = [];
    
    if (!data || !data.questions || !Array.isArray(data.questions)) {
      errors.push('Formato invalido: "questions" deve ser um array');
      return errors;
    }
    
    data.questions.forEach((q: any, index: number) => {
      if (!q.question || typeof q.question !== 'string' || q.question.trim().length < 10) {
        errors.push(`Questao ${index + 1}: Texto da pergunta invalido ou muito curto`);
      }
      
      if (!q.alternatives || !Array.isArray(q.alternatives)) {
        errors.push(`Questao ${index + 1}: Alternativas invalidas`);
        return;
      }
      
      if (q.alternatives.length !== expectedAlts) {
        errors.push(`Questao ${index + 1}: Esperado ${expectedAlts} alternativas, recebido ${q.alternatives.length}`);
      }
      
      const correctCount = q.alternatives.filter((a: any) => a.isCorrect === true).length;
      if (correctCount !== 1) {
        errors.push(`Questao ${index + 1}: Deve ter exatamente 1 alternativa correta, encontrou ${correctCount}`);
      }
    });
    
    return errors;
  };
  
  const validationErrors = validateQuestions(parsed, payload.alternativesCount);
  if (validationErrors.length > 0) {
    console.error('Local validation errors:', validationErrors);
    throw new Error(`A IA gerou questoes com problemas: ${validationErrors.join(', ')}`);
  }

  return parsed;
};

export const getGeminiConfigStatus = () => ({
  mode: 'serverless',
  localFallbackEnabled: Boolean(import.meta.env.DEV && localFallbackKey),
  modelName: localFallbackModel,
});

export const generateQuestions = async (
  area: string,
  topic: string,
  count: number,
  difficulty: string,
  rawContent: string,
  isContestHighlight = false
) => {
  const payload: GenerateQuestionsPayload = {
    area,
    topic,
    count,
    difficulty,
    rawContent,
    alternativesCount: isContestHighlight ? 5 : 4,
  };

  try {
    const response = await fetch('/api/generate-questions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'generate',
        area_name: area,
        topic_name: topic,
        count,
        difficulty,
        context: rawContent,
        is_contest_highlight: isContestHighlight,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result?.error || 'Falha ao gerar questoes com a API.');
    }

    return result;
  } catch (error) {
    if (import.meta.env.DEV && localFallbackKey) {
      try {
        return await generateQuestionsLocally(payload);
      } catch (fallbackError) {
        throw new Error(getErrorMessage(fallbackError));
      }
    }

    throw new Error(getErrorMessage(error));
  }
};
