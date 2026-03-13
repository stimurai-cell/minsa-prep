import { GoogleGenAI, Type } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

const defaultGeminiModel = 'gemini-2.5-flash';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const buildQuestionsPrompt = ({
  area,
  topic,
  count,
  difficulty,
  rawContent,
  alternativesCount,
}: {
  area: string;
  topic: string;
  count: number;
  difficulty: string;
  rawContent: string;
  alternativesCount: number;
}) => `
  Voce e um especialista em concursos publicos da area da saude em Angola (MINSA).
  Gere ${count} questoes de multipla escolha sobre o topico "${topic}" da area de "${area}".

  REGRAS CRITICAS:
  1. Use portugues correto com todos os acentos e pontuacao.
  2. Cada questao deve ter exatamente ${alternativesCount} alternativas (A, B, C, D, E).
  3. Estilo de escrita: Use termos angolanos.
  4. O nivel de dificuldade deve ser "${difficulty}".
  5. Baseie-se no seguinte conteudo de referencia (se fornecido):
  ${rawContent}

  Retorne apenas um JSON valido seguindo estritamente este formato:
  {
    "questions": [
      {
        "question": "Texto da pergunta",
        "alternatives": [
          {"text": "Opcao A", "isCorrect": false},
          {"text": "Opcao B", "isCorrect": false},
          {"text": "Opcao C", "isCorrect": true},
          {"text": "Opcao D", "isCorrect": false},
          {"text": "Opcao E", "isCorrect": false}
        ],
        "explanation": "Explicacao detalhada.",
        "difficulty": "${difficulty}"
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
    return 'A quota do Gemini acabou.';
  }
  return message;
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo nao permitido.' });
  }

  const { action, area_id, topic_id, custom_topic_name, count, difficulty, context, generated_data, area_name, topic_name, is_contest_highlight } = req.body || {};
  const apiKey = process.env.GEMINI_API_KEY;
  const modelName = process.env.GEMINI_MODEL || defaultGeminiModel;

  // Status Action
  if (action === 'status') {
    return res.status(200).json({ model: modelName, mode: 'Vercel API' });
  }

  // Save Action
  if (action === 'save') {
    if (!generated_data || !generated_data.questions) {
      return res.status(400).json({ error: 'Dados para guardar ausentes.' });
    }

    try {
      let finalTopicId = generated_data.topic_id;

      // Se for novo tópico, criar primeiro
      if (!finalTopicId && generated_data.custom_topic_name && generated_data.area_id) {
        // Verificar se o tópico já existe para evitar duplicatas acidentais
        const { data: existingTopic } = await supabase
          .from('topics')
          .select('id')
          .eq('area_id', generated_data.area_id)
          .eq('name', generated_data.custom_topic_name)
          .maybeSingle();

        if (existingTopic) {
          finalTopicId = existingTopic.id;
        } else {
          const { data: newTopic, error: topicError } = await supabase
            .from('topics')
            .insert({
              name: generated_data.custom_topic_name,
              area_id: generated_data.area_id,
              description: `Gerado automaticamente via IA para ${generated_data.area_name || 'Especialidade'}`
            })
            .select()
            .single();

          if (topicError) throw topicError;
          finalTopicId = newTopic.id;
        }
      }

      if (!finalTopicId) throw new Error('ID do tópico não identificado.');

      let savedCount = 0;
      for (const q of generated_data.questions) {
        if (!q.alternatives || q.alternatives.length !== 5) {
          throw new Error(`Quantidade de alternativas inválida para a pergunta "${q.question}". Esperado 5.`);
        }
        // 1. Inserir a Pergunta
        const { data: quest, error: qError } = await supabase
          .from('questions')
          .insert({
            topic_id: finalTopicId,
            content: q.question,
            difficulty: q.difficulty || 'medium',
            is_contest_highlight: generated_data.is_contest_highlight || false
          })
          .select()
          .single();

        if (qError) throw qError;

        // 2. Inserir Alternativas
        const alternatives = q.alternatives.map((alt: any) => ({
          question_id: quest.id,
          content: alt.text,
          is_correct: alt.isCorrect
        }));

        const { error: aError } = await supabase.from('alternatives').insert(alternatives);
        if (aError) throw aError;

        // 3. Inserir Explicação
        if (q.explanation) {
          const { error: eError } = await supabase.from('question_explanations').insert({
            question_id: quest.id,
            content: q.explanation
          });
          // Se houver erro, logamos. O erro mais comum é constraint violation se o ID não bater.
          if (eError) {
            console.error('Erro GRANDE ao salvar explicação:', eError.message, eError.details);
            throw new Error(`Erro ao salvar explicacao: ${eError.message}`);
          }
        }
        savedCount++;
      }

      return res.status(200).json({ saved_count: savedCount, topic_id: finalTopicId });
    } catch (err: any) {
      console.error('Save error details:', err);
      return res.status(500).json({ error: err.message || 'Erro interno ao salvar no Supabase' });
    }
  }

  // Generate Action
  if (action === 'generate') {
    if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY nao configurada.' });

    const ai = new GoogleGenAI({ apiKey });
    try {
      const targetArea = area_name || 'Saude';
      const targetTopic = topic_name || custom_topic_name || 'Geral';

      const alternativesCount = 5;

      const response = await ai.models.generateContent({
        model: modelName,
        contents: buildQuestionsPrompt({
          area: targetArea,
          topic: targetTopic,
          count: count || 5,
          difficulty: difficulty || 'medium',
          rawContent: context || '',
          alternativesCount,
        }),
        config: {
          responseMimeType: 'application/json',
        },
      });

      if (!response.text) throw new Error('O Gemini respondeu vazio.');

      const parsed = JSON.parse(response.text);
      // Incluir metadados para o salvamento posterior
      return res.status(200).json({
        ...parsed,
        area_id,
        topic_id,
        custom_topic_name,
        is_contest_highlight
      });
    } catch (error) {
      return res.status(500).json({ error: getErrorMessage(error) });
    }
  }

  return res.status(400).json({ error: 'Acao invalida.' });
}
