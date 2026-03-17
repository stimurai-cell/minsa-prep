import { GoogleGenAI, Type } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

const defaultGeminiModel = 'gemini-2.5-flash';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let supabase;
if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey);
}

const buildQuestionsPrompt = ({
  area,
  topic,
  count,
  difficulty,
  context,
  alternativesCount = 4,
}: {
  area: string;
  topic: string;
  count: number;
  difficulty: string;
  context: string;
  alternativesCount: number;
}) => `
ESPECIALISTA EM CONCURSOS DE SAÚDE EM ANGOLA
ÁREA: ${area}
TÓPICO: ${topic}
QUANTIDADE: ${count} questões
DIFICULDADE: ${difficulty}
ALTERNATIVAS: ${alternativesCount}
CONTEXTO ADICIONAL: ${context || 'Nenhum'}

REGRAS IMPORTANTES:
- Use português de Angola correto
- Crie perguntas realistas para concursos públicos de saúde
- Alternativas devem ser plausíveis mas incorretas (exceto a correta)
- Apenas uma alternativa deve estar correta
- Inclua explicações detalhadas para cada pergunta

PROCESSO OBRIGATÓRIO:
1. Defina a resposta correta primeiro
2. Crie alternativas incorretas plausíveis
3. Verifique se apenas uma alternativa está correta
4. Verifique se as outras estão realmente incorretas

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
      "difficulty": "${difficulty}",
      "is_contest_highlight": false
    }
  ]
}
`;

type IncomingQuestion = {
  question?: string;
  content?: string;
  alternatives: Array<{
    text?: string;
    content?: string;
    isCorrect?: boolean;
    is_correct?: boolean;
  }>;
  explanation?: string;
  difficulty?: string;
  is_contest_highlight?: boolean;
};

const normalizeQuestions = (rawQuestions: IncomingQuestion[] = []) => {
  return rawQuestions.map((q) => {
    const questionText = q.question || q.content || '';
    const alternatives = (q.alternatives || []).map((alt) => ({
      text: alt.text || alt.content || '',
      isCorrect: typeof alt.isCorrect === 'boolean' ? alt.isCorrect : Boolean(alt.is_correct),
    }));

    return {
      question: questionText,
      alternatives,
      explanation: q.explanation || '',
      difficulty: q.difficulty || 'medium',
      is_contest_highlight: Boolean(q.is_contest_highlight),
    };
  });
};

const validateQuestions = (questions: ReturnType<typeof normalizeQuestions>, expectedAlts: number) => {
  const errors: string[] = [];

  questions.forEach((q, idx) => {
    if (!q.question || q.question.trim().length < 10) {
      errors.push(`Q${idx + 1}: enunciado vazio/curto`);
    }
    if (!q.alternatives || q.alternatives.length !== expectedAlts) {
      errors.push(`Q${idx + 1}: precisa de ${expectedAlts} alternativas`);
    } else {
      const correct = q.alternatives.filter((a) => a.isCorrect === true).length;
      if (correct !== 1) {
        errors.push(`Q${idx + 1}: deve ter exatamente 1 correta (achou ${correct})`);
      }
      const seenAlt = new Set<string>();
      q.alternatives.forEach((a, aIdx) => {
        if (!a.text || a.text.trim().length < 2) {
          errors.push(`Q${idx + 1} alt ${aIdx + 1}: texto vazio`);
        }
        const key = a.text.trim().toLowerCase();
        if (seenAlt.has(key)) {
          errors.push(`Q${idx + 1} alt ${aIdx + 1}: alternativa duplicada`);
        } else {
          seenAlt.add(key);
        }
      });
    }
  });

  // Duplicação de enunciado
  const seenQuestions = new Set<string>();
  questions.forEach((q, idx) => {
    const key = q.question.trim().toLowerCase();
    if (seenQuestions.has(key)) {
      errors.push(`Q${idx + 1}: enunciado duplicado`);
    } else {
      seenQuestions.add(key);
    }
  });

  return errors;
};

const getErrorMessage = (error: unknown) => {
  if (!(error instanceof Error)) {
    return 'Falha desconhecida ao comunicar com o Gemini.';
  }
  const message = error.message;
  if (message.includes('RESOURCE_EXHAUSTED') || message.includes('"code":429')) {
    return 'A quota do Gemini acabou. Tente novamente mais tarde.';
  }
  if (message.toLowerCase().includes('permission') || message.toLowerCase().includes('apikey')) {
    return 'A chave do Gemini parece inválida ou sem acesso ao modelo.';
  }
  return message;
};

export default async function handler(req: any, res: any) {
  console.log('API called:', req.method, req.url);
  console.log('Body:', req.body);

  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Método não permitido.' });
    }

    const { action } = req.body;
    const modelName = process.env.GEMINI_MODEL || defaultGeminiModel;

    // Status Action
    if (action === 'status') {
      return res.status(200).json({
        model: modelName,
        mode: 'Vercel API',
        timestamp: new Date().toISOString(),
      });
    }

    // Generate Action
    if (action === 'generate') {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY não configurada.' });
      }

      const {
        area_id,
        area_name,
        topic_id,
        topic_name,
        custom_topic_name,
        count = 5,
        difficulty = 'medium',
        context = '',
        is_contest_highlight = false,
      } = req.body;

      if (!area_id || !area_name || (!topic_id && !custom_topic_name && !topic_name)) {
        return res.status(400).json({ error: 'Área e tópico são obrigatórios.' });
      }

      const topic = custom_topic_name || topic_name;
      const alternativesCount = is_contest_highlight ? 5 : 4;

      const ai = new GoogleGenAI({ apiKey });

      const runGeneration = async () => {
        const start = Date.now();
        const response = await ai.models.generateContent({
          model: modelName,
          contents: buildQuestionsPrompt({
            area: area_name,
            topic: topic,
            count,
            difficulty,
            context,
            alternativesCount,
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
                      is_contest_highlight: { type: Type.BOOLEAN },
                    },
                    required: ['question', 'alternatives', 'explanation', 'difficulty'],
                  },
                },
              },
              required: ['questions'],
            },
          },
        });
        console.log('[generate-questions] duration_ms=', Date.now() - start);
        return response;
      };

      try {
        let response = await runGeneration();
        let parsed = response.text ? JSON.parse(response.text) : null;

        const attemptValidation = (parsedPayload: any) => {
          if (!parsedPayload) {
            return { normalized: [], validationErrors: ['Gemini retornou vazio'] };
          }
          const normalized = normalizeQuestions(parsedPayload.questions);
          const validationErrors = validateQuestions(normalized, alternativesCount);
          return { normalized, validationErrors };
        };

        let { normalized, validationErrors } = attemptValidation(parsed);

        if (validationErrors.length) {
          console.warn('[generate-questions] primeira validação falhou', validationErrors);
          response = await runGeneration(); // segunda tentativa (2-pass)
          parsed = response.text ? JSON.parse(response.text) : null;
          ({ normalized, validationErrors } = attemptValidation(parsed));
        }

        if (validationErrors?.length) {
          return res.status(422).json({
            error: 'A IA devolveu perguntas inválidas após 2 tentativas.',
            validation_errors: validationErrors,
          });
        }

        if (is_contest_highlight) {
          normalized.forEach((q: any) => (q.is_contest_highlight = true));
        }

        return res.status(200).json({
          area_id,
          area_name,
          topic_id,
          topic_name,
          custom_topic_name,
          count,
          difficulty,
          is_contest_highlight,
          questions: normalized,
        });
      } catch (error: any) {
        console.error('Error generating questions:', error);
        return res.status(500).json({ error: getErrorMessage(error) });
      }
    }

    // Save Action
    if (action === 'save') {
      if (!supabase) {
        return res.status(500).json({ error: 'Supabase não configurado.' });
      }

      const { generated_data } = req.body;
      if (!generated_data || !generated_data.questions) {
        return res.status(400).json({ error: 'Dados gerados são obrigatórios.' });
      }

      const { area_id, topic_id, custom_topic_name, questions } = generated_data;

      if (!area_id || (!topic_id && !custom_topic_name)) {
        return res.status(400).json({ error: 'Área e tópico são obrigatórios.' });
      }

      let finalTopicId = topic_id;

      // Create custom topic if needed
      if (custom_topic_name && !topic_id) {
        const { data: newTopic, error: topicError } = await supabase
          .from('topics')
          .insert({
            area_id: area_id,
            name: custom_topic_name,
            description: `Tópico gerado por IA: ${custom_topic_name}`,
          })
          .select('id')
          .single();

        if (topicError) {
          return res.status(500).json({ error: 'Erro ao criar tópico: ' + topicError.message });
        }

        finalTopicId = newTopic.id;
      }

      // Save questions
      const savedQuestions = [];
      const normalizedForSave = normalizeQuestions(questions);

      for (const question of normalizedForSave) {
        const { data: newQuestion, error: questionError } = await supabase
          .from('questions')
          .insert({
            topic_id: finalTopicId,
            content: question.question,
            difficulty: question.difficulty,
            is_contest_highlight: question.is_contest_highlight || false,
          })
          .select('id')
          .single();

        if (questionError) {
          console.error('Error saving question:', questionError);
          continue;
        }

        // Save alternatives
        for (const alternative of question.alternatives) {
          await supabase.from('alternatives').insert({
            question_id: newQuestion.id,
            content: alternative.text,
            is_correct: alternative.isCorrect,
          });
        }

        // Save explanation
        if (question.explanation) {
          await supabase.from('question_explanations').insert({
            question_id: newQuestion.id,
            content: question.explanation,
          });
        }

        savedQuestions.push(newQuestion);
      }

      return res.status(200).json({
        success: true,
        saved_count: savedQuestions.length,
      });
    }

    return res.status(400).json({ error: 'Ação inválida.' });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: getErrorMessage(error) });
  }
}

// Export for lightweight tests
export const _validateQuestionsForTest = validateQuestions;
