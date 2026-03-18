import { GoogleGenAI, Type } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import { buildQuestionsPrompt, defaultGeminiModel } from '../src/lib/gemini-config';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const databaseUrl = process.env.DATABASE_URL || '';
const geminiApiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';

let supabase;
if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey);
}

type PgClient = {
  query: (sql: string, params?: any[]) => Promise<{ rows: any[] }>;
  release: () => void;
};

let pgPool: any = null;
const getPgPool = async () => {
  if (!databaseUrl) return null;
  if (!pgPool) {
    const { Pool } = await import('pg');
    pgPool = new Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false }, max: 3 });
  }
  return pgPool;
};

type IncomingQuestion = {
  question?: string;
  content?: string;
  alternatives?: Array<{ text?: string; content?: string; isCorrect?: boolean; is_correct?: boolean }>;
  explanation?: string;
  difficulty?: string;
  is_contest_highlight?: boolean;
};

type NormalizedQuestion = {
  question: string;
  alternatives: Array<{ text: string; isCorrect: boolean }>;
  explanation: string;
  difficulty: string;
  is_contest_highlight: boolean;
};

type PersistInput = {
  area_id: string;
  topic_id?: string | null;
  custom_topic_name?: string | null;
  questions: IncomingQuestion[];
  is_contest_highlight?: boolean;
};

type PersistResult = {
  topicId: string;
  topicCreated: boolean;
  savedCount: number;
  skippedCount: number;
};

const normalizeQuestions = (rawQuestions: IncomingQuestion[] = []): NormalizedQuestion[] => rawQuestions.map((q) => ({
  question: String(q.question || q.content || '').trim(),
  alternatives: (q.alternatives || []).map((alt) => ({
    text: String(alt.text || alt.content || '').trim(),
    isCorrect: typeof alt.isCorrect === 'boolean' ? alt.isCorrect : Boolean(alt.is_correct),
  })),
  explanation: String(q.explanation || '').trim(),
  difficulty: String(q.difficulty || 'medium').trim() || 'medium',
  is_contest_highlight: Boolean(q.is_contest_highlight),
}));

const validateQuestions = (questions: NormalizedQuestion[], expectedAlternatives: number) => {
  const errors: string[] = [];
  if (!questions.length) {
    errors.push('Nenhuma pergunta foi gerada');
    return errors;
  }
  const seenQuestions = new Set<string>();

  questions.forEach((question, index) => {
    if (!question.question || question.question.length < 10) {
      errors.push(`Q${index + 1}: enunciado vazio/curto`);
    }

    if (!question.alternatives || question.alternatives.length !== expectedAlternatives) {
      errors.push(`Q${index + 1}: precisa de ${expectedAlternatives} alternativas`);
    } else {
      const correctCount = question.alternatives.filter((alternative) => alternative.isCorrect).length;
      if (correctCount !== 1) {
        errors.push(`Q${index + 1}: deve ter exatamente 1 correta (achou ${correctCount})`);
      }

      const seenAlternatives = new Set<string>();
      question.alternatives.forEach((alternative, altIndex) => {
        if (!alternative.text || alternative.text.length < 2) {
          errors.push(`Q${index + 1} alt ${altIndex + 1}: texto vazio`);
        }
        const altKey = alternative.text.toLowerCase();
        if (seenAlternatives.has(altKey)) {
          errors.push(`Q${index + 1} alt ${altIndex + 1}: alternativa duplicada`);
        }
        seenAlternatives.add(altKey);
      });
    }

    const questionKey = question.question.toLowerCase();
    if (seenQuestions.has(questionKey)) {
      errors.push(`Q${index + 1}: enunciado duplicado`);
    }
    seenQuestions.add(questionKey);
  });

  return errors;
};

const getErrorMessage = (error: unknown) => {
  if (!(error instanceof Error)) return 'Falha desconhecida ao comunicar com a IA.';
  const message = error.message;
  if (message.toLowerCase().includes('reported as leaked')) {
    return 'A chave do Gemini foi bloqueada por vazamento. Gere uma nova chave no Google AI Studio e atualize GEMINI_API_KEY/VITE_GEMINI_API_KEY.';
  }
  if (message.includes('RESOURCE_EXHAUSTED') || message.includes('"code":429')) return 'A quota do Gemini acabou. Tente novamente mais tarde.';
  if (message.includes('NOT_FOUND') || message.toLowerCase().includes('model') && message.toLowerCase().includes('not found')) {
    return 'O modelo Gemini configurado nao esta disponivel para esta chave. Ajuste GEMINI_MODEL para um modelo suportado.';
  }
  if (message.toLowerCase().includes('apikey') || message.toLowerCase().includes('permission')) return 'A chave do Gemini parece invalida ou sem acesso ao modelo.';
  return message;
};

const buildModelCandidates = (primaryModel: string) => Array.from(new Set([primaryModel, defaultGeminiModel, 'gemini-2.5-flash'].filter(Boolean)));

const extractResponseText = (response: any) => {
  if (!response) return '';
  if (typeof response.text === 'function') return response.text();
  if (typeof response.text === 'string') return response.text;
  if (Array.isArray(response.candidates)) {
    return response.candidates
      .flatMap((candidate: any) => candidate?.content?.parts || [])
      .map((part: any) => part?.text || '')
      .join('');
  }
  return '';
};

const parseGeneratedPayload = (rawText: string) => {
  const cleaned = rawText.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  return JSON.parse(cleaned);
};

const resolveTopicWithPg = async (client: PgClient, areaId: string, topicId?: string | null, customTopicName?: string | null) => {
  if (topicId) return { topicId, topicCreated: false };
  const topicName = String(customTopicName || '').trim();
  if (!topicName) throw new Error('Area e topico sao obrigatorios.');

  const existing = await client.query('select id from public.topics where area_id = $1 and lower(name) = lower($2) limit 1', [areaId, topicName]);
  if (existing.rows[0]?.id) return { topicId: existing.rows[0].id as string, topicCreated: false };

  const inserted = await client.query(
    'insert into public.topics (area_id, name, description) values ($1, $2, $3) returning id',
    [areaId, topicName, `Topico gerado por IA: ${topicName}`],
  );

  return { topicId: inserted.rows[0].id as string, topicCreated: true };
};

const persistWithPostgres = async (input: PersistInput): Promise<PersistResult> => {
  const pool = await getPgPool();
  if (!pool) throw new Error('DATABASE_URL nao configurada.');

  const client = await pool.connect();
  try {
    const normalized = normalizeQuestions(input.questions);
    const expectedAlternatives = input.is_contest_highlight ? 5 : (normalized[0]?.alternatives.length || 4);
    const validationErrors = validateQuestions(normalized, expectedAlternatives);
    if (validationErrors.length) {
      throw new Error(`Perguntas invalidas para guardar: ${validationErrors.join('; ')}`);
    }

    await client.query('BEGIN');
    const { topicId, topicCreated } = await resolveTopicWithPg(client, input.area_id, input.topic_id, input.custom_topic_name);

    let savedCount = 0;
    let skippedCount = 0;

    for (const question of normalized) {
      const duplicate = await client.query(
        'select id from public.questions where topic_id = $1 and lower(content) = lower($2) limit 1',
        [topicId, question.question],
      );

      if (duplicate.rows[0]?.id) {
        skippedCount += 1;
        continue;
      }

      const insertedQuestion = await client.query(
        'insert into public.questions (topic_id, area_id, content, difficulty, is_contest_highlight) values ($1, $2, $3, $4, $5) returning id',
        [topicId, input.area_id, question.question, question.difficulty, input.is_contest_highlight || question.is_contest_highlight],
      );

      const questionId = insertedQuestion.rows[0].id as string;

      for (const alternative of question.alternatives) {
        await client.query('insert into public.alternatives (question_id, content, is_correct) values ($1, $2, $3)', [questionId, alternative.text, alternative.isCorrect]);
      }

      if (question.explanation) {
        await client.query('insert into public.question_explanations (question_id, content) values ($1, $2)', [questionId, question.explanation]);
      }

      savedCount += 1;
    }

    await client.query('COMMIT');
    return { topicId, topicCreated, savedCount, skippedCount };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const persistWithSupabase = async (input: PersistInput): Promise<PersistResult> => {
  if (!supabase) throw new Error('Supabase nao configurado.');

  const normalized = normalizeQuestions(input.questions);
  const expectedAlternatives = input.is_contest_highlight ? 5 : (normalized[0]?.alternatives.length || 4);
  const validationErrors = validateQuestions(normalized, expectedAlternatives);
  if (validationErrors.length) {
    throw new Error(`Perguntas invalidas para guardar: ${validationErrors.join('; ')}`);
  }

  let finalTopicId = input.topic_id || null;
  let topicCreated = false;

  if (!finalTopicId) {
    const topicName = String(input.custom_topic_name || '').trim();
    const existing = await supabase.from('topics').select('id').eq('area_id', input.area_id).ilike('name', topicName).limit(1).maybeSingle();
    if (existing.data?.id) {
      finalTopicId = existing.data.id;
    } else {
      const created = await supabase
        .from('topics')
        .insert({ area_id: input.area_id, name: topicName, description: `Topico gerado por IA: ${topicName}` })
        .select('id')
        .single();
      if (created.error) throw created.error;
      finalTopicId = created.data.id;
      topicCreated = true;
    }
  }

  let savedCount = 0;
  let skippedCount = 0;

  for (const question of normalized) {
    const duplicate = await supabase.from('questions').select('id').eq('topic_id', finalTopicId).ilike('content', question.question).limit(1).maybeSingle();
    if (duplicate.data?.id) {
      skippedCount += 1;
      continue;
    }

    const insertedQuestion = await supabase
      .from('questions')
      .insert({
        topic_id: finalTopicId,
        area_id: input.area_id,
        content: question.question,
        difficulty: question.difficulty,
        is_contest_highlight: input.is_contest_highlight || question.is_contest_highlight,
      })
      .select('id')
      .single();

    if (insertedQuestion.error) throw insertedQuestion.error;

    for (const alternative of question.alternatives) {
      const altInsert = await supabase.from('alternatives').insert({ question_id: insertedQuestion.data.id, content: alternative.text, is_correct: alternative.isCorrect });
      if (altInsert.error) throw altInsert.error;
    }

    if (question.explanation) {
      const explanationInsert = await supabase.from('question_explanations').insert({ question_id: insertedQuestion.data.id, content: question.explanation });
      if (explanationInsert.error) throw explanationInsert.error;
    }

    savedCount += 1;
  }

  return { topicId: finalTopicId as string, topicCreated, savedCount, skippedCount };
};

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Metodo nao permitido.' });
    }

    const { action } = req.body || {};
    const modelName = process.env.GEMINI_MODEL || process.env.VITE_GEMINI_MODEL || defaultGeminiModel;
    const modelCandidates = buildModelCandidates(modelName);

    if (action === 'status') {
      return res.status(200).json({
        model: modelName,
        model_candidates: modelCandidates,
        mode: geminiApiKey ? 'server-api' : 'missing-gemini-key',
        can_generate: Boolean(geminiApiKey),
        can_save: Boolean(databaseUrl || supabase),
        save_mode: databaseUrl ? 'database-url' : supabase ? 'service-role' : 'missing-save-backend',
      });
    }

    if (action === 'generate') {
      if (!geminiApiKey) {
        return res.status(500).json({ error: 'Nenhuma chave Gemini configurada no servidor.' });
      }

      const { area_id, area_name, topic_id, topic_name, custom_topic_name, count = 5, difficulty = 'medium', context = '', is_contest_highlight = false } = req.body || {};
      const resolvedAreaName = String(area_name || '').trim();
      const resolvedTopicName = String(custom_topic_name || topic_name || '').trim();

      if (!resolvedAreaName || !resolvedTopicName) {
        return res.status(400).json({ error: 'Area e topico sao obrigatorios.' });
      }

      const alternativesCount = is_contest_highlight ? 5 : 4;
      const ai = new GoogleGenAI({ apiKey: geminiApiKey });
      let parsed: any = null;
      let normalized: NormalizedQuestion[] = [];
      let validationErrors: string[] = [];
      let modelUsed = modelCandidates[0];
      let lastError: unknown = null;

      for (const candidateModel of modelCandidates) {
        const runGeneration = async () => ai.models.generateContent({
          model: candidateModel,
          contents: buildQuestionsPrompt({
            area: resolvedAreaName,
            topic: resolvedTopicName,
            count: Number(count) || 5,
            difficulty,
            rawContent: context || '',
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

        try {
          for (let attempt = 1; attempt <= 2; attempt += 1) {
            const response = await runGeneration();
            const rawText = extractResponseText(response);
            parsed = rawText ? parseGeneratedPayload(rawText) : null;
            normalized = normalizeQuestions(parsed?.questions || []);
            validationErrors = validateQuestions(normalized, alternativesCount);
            if (!validationErrors.length) {
              modelUsed = candidateModel;
              break;
            }
            console.warn('[generate-questions] validation failed attempt', attempt, candidateModel, validationErrors);
          }

          if (!validationErrors.length) {
            break;
          }
        } catch (error) {
          lastError = error;
          console.warn('[generate-questions] model failed', candidateModel, getErrorMessage(error));
          continue;
        }
      }

      if (validationErrors.length && lastError) {
        throw lastError;
      }

      if (!normalized.length && lastError) {
        throw lastError;
      }

      if (validationErrors.length) {
        return res.status(422).json({ error: 'A IA devolveu perguntas invalidas apos 2 tentativas.', validation_errors: validationErrors });
      }

      if (is_contest_highlight) {
        normalized.forEach((question) => {
          question.is_contest_highlight = true;
        });
      }

      return res.status(200).json({
        area_id,
        area_name: resolvedAreaName,
        topic_id,
        topic_name,
        custom_topic_name,
        count,
        difficulty,
        is_contest_highlight,
        model_used: modelUsed,
        questions: normalized,
      });
    }

    if (action === 'save') {
      const { generated_data } = req.body || {};
      if (!generated_data?.questions) {
        return res.status(400).json({ error: 'Dados gerados sao obrigatorios.' });
      }

      const payload: PersistInput = {
        area_id: generated_data.area_id,
        topic_id: generated_data.topic_id,
        custom_topic_name: generated_data.custom_topic_name,
        questions: generated_data.questions,
        is_contest_highlight: Boolean(generated_data.is_contest_highlight),
      };

      if (!payload.area_id || (!payload.topic_id && !payload.custom_topic_name)) {
        return res.status(400).json({ error: 'Area e topico sao obrigatorios.' });
      }

      const result = databaseUrl ? await persistWithPostgres(payload) : await persistWithSupabase(payload);
      return res.status(200).json({
        success: true,
        topic_id: result.topicId,
        topic_created: result.topicCreated,
        saved_count: result.savedCount,
        skipped_count: result.skippedCount,
        save_mode: databaseUrl ? 'database-url' : 'service-role',
      });
    }

    return res.status(400).json({ error: 'Acao invalida.' });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: getErrorMessage(error) });
  }
}

export const _validateQuestionsForTest = validateQuestions;
