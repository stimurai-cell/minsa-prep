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
      "content": "Texto da pergunta",
      "alternatives": [
        {"content": "Opção A", "is_correct": false},
        {"content": "Opção B", "is_correct": false},
        {"content": "Opção C", "is_correct": true},
        {"content": "Opção D", "is_correct": false}${
          alternativesCount === 5 ? `,
        {"content": "Opção E", "is_correct": false}` : ''
        }
      ],
      "explanation": "Explicação detalhada",
      "difficulty": "${difficulty}",
      "is_contest_highlight": false
    }
  ]
}
`;

const getErrorMessage = (error: unknown) => {
  if (!(error instanceof Error)) {
    return 'Falha desconhecida ao comunicar com o Gemini.';
  }
  const message = error.message;
  if (message.includes('RESOURCE_EXHAUSTED') || message.includes('"code":429')) {
    return 'A quota do Gemini acabou. Tente novamente mais tarde.';
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
        timestamp: new Date().toISOString()
      });
    }

    // Generate Action
    if (action === 'generate') {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY não configurada.' });
      }

      const {
        area_name,
        topic_name,
        custom_topic_name,
        count = 5,
        difficulty = 'medium',
        context = '',
        is_contest_highlight = false
      } = req.body;

      if (!area_name || (!topic_name && !custom_topic_name)) {
        return res.status(400).json({ error: 'Área e tópico são obrigatórios.' });
      }

      const topic = custom_topic_name || topic_name;
      
      const ai = new GoogleGenAI({ apiKey });

      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: buildQuestionsPrompt({
            area: area_name,
            topic: topic,
            count,
            difficulty,
            context,
            alternativesCount: 4
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
                      content: { type: Type.STRING },
                      alternatives: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            content: { type: Type.STRING },
                            is_correct: { type: Type.BOOLEAN }
                          },
                          required: ['content', 'is_correct']
                        }
                      },
                      explanation: { type: Type.STRING },
                      difficulty: { type: Type.STRING },
                      is_contest_highlight: { type: Type.BOOLEAN }
                    },
                    required: ['content', 'alternatives', 'explanation', 'difficulty', 'is_contest_highlight']
                  }
                }
              },
              required: ['questions']
            }
          }
        });

        if (!response.text) {
          return res.status(502).json({ error: 'Gemini retornou vazio.' });
        }

        const result = JSON.parse(response.text);
        console.log('Raw Gemini response:', response.text);
        console.log('Parsed result:', JSON.stringify(result, null, 2));
        
        // Mark as contest highlight if requested
        if (is_contest_highlight && result.questions) {
          result.questions.forEach((q: any) => {
            q.is_contest_highlight = true;
          });
        }

        return res.status(200).json(result);
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
            description: `Tópico gerado por IA: ${custom_topic_name}`
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
      for (const question of questions) {
        const { data: newQuestion, error: questionError } = await supabase
          .from('questions')
          .insert({
            topic_id: finalTopicId,
            content: question.content,
            difficulty: question.difficulty,
            is_contest_highlight: question.is_contest_highlight || false
          })
          .select('id')
          .single();

        if (questionError) {
          console.error('Error saving question:', questionError);
          continue;
        }

        // Save alternatives
        for (const alternative of question.alternatives) {
          await supabase
            .from('alternatives')
            .insert({
              question_id: newQuestion.id,
              content: alternative.content,
              is_correct: alternative.is_correct
            });
        }

        // Save explanation
        if (question.explanation) {
          await supabase
            .from('question_explanations')
            .insert({
              question_id: newQuestion.id,
              content: question.explanation
            });
        }

        savedQuestions.push(newQuestion);
      }

      return res.status(200).json({ 
        success: true,
        saved_count: savedQuestions.length
      });
    }

    return res.status(400).json({ error: 'Ação inválida.' });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: getErrorMessage(error) });
  }
}
