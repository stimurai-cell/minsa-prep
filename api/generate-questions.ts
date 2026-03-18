const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const databaseUrl = process.env.DATABASE_URL || '';
const geminiApiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
const defaultGeminiModel = 'gemini-2.5-flash';

let supabaseClientPromise: Promise<any> | null = null;
let pgPoolPromise: Promise<any> | null = null;

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

type PgClient = {
  query: (sql: string, params?: any[]) => Promise<{ rows: any[] }>;
  release: () => void;
};

const MAX_REFERENCE_QUESTIONS = 30;
const QUESTION_SIMILARITY_THRESHOLD = 0.82;
const fillerWords = new Set([
  'a',
  'ao',
  'aos',
  'as',
  'com',
  'da',
  'das',
  'de',
  'do',
  'dos',
  'e',
  'em',
  'na',
  'nas',
  'no',
  'nos',
  'o',
  'os',
  'ou',
  'para',
  'por',
  'que',
  'se',
  'um',
  'uma',
]);

const normalizeDifficulty = (value?: string) => {
  const normalized = String(value || 'medium').trim().toLowerCase();

  if (['easy', 'facil', 'fácil'].includes(normalized)) return 'easy';
  if (['medium', 'medio', 'médio', 'normal'].includes(normalized)) return 'medium';
  if (['hard', 'dificil', 'difícil'].includes(normalized)) return 'hard';

  return 'medium';
};

const getDifficultyInstruction = (difficulty: string) => {
  switch (difficulty) {
    case 'easy':
      return 'FACIL: enunciado direto, 1 conceito central, distratores simples e sem armadilhas.';
    case 'hard':
      return 'DIFICIL: exige interpretacao clinica, relacao entre normas/condutas e distratores plausiveis.';
    default:
      return 'MEDIO: exige compreensao pratica, mas sem depender de pegadinhas excessivas.';
  }
};

const normalizeQuestionIdentity = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokenizeQuestion = (value: string) =>
  normalizeQuestionIdentity(value)
    .split(' ')
    .filter((token) => token.length > 2 && !fillerWords.has(token));

const calculateQuestionSimilarity = (left: string, right: string) => {
  const normalizedLeft = normalizeQuestionIdentity(left);
  const normalizedRight = normalizeQuestionIdentity(right);

  if (!normalizedLeft || !normalizedRight) return 0;
  if (normalizedLeft === normalizedRight) return 1;

  const minLength = Math.min(normalizedLeft.length, normalizedRight.length);
  if (minLength > 40 && (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft))) {
    return 0.97;
  }

  const leftTokens = tokenizeQuestion(left);
  const rightTokens = tokenizeQuestion(right);
  if (!leftTokens.length || !rightTokens.length) return 0;

  const leftSet = new Set(leftTokens);
  const rightSet = new Set(rightTokens);
  const intersection = leftTokens.filter((token) => rightSet.has(token)).length;
  const union = new Set([...leftSet, ...rightSet]).size || 1;
  const jaccard = intersection / union;

  const prefixWindow = Math.min(8, leftTokens.length, rightTokens.length);
  const prefixMatches = Array.from({ length: prefixWindow }).filter((_, index) => leftTokens[index] === rightTokens[index]).length;
  const prefixScore = prefixWindow > 0 ? prefixMatches / prefixWindow : 0;

  return Math.max(jaccard, prefixScore * 0.94);
};

const isNearDuplicateQuestion = (candidate: string, references: string[]) =>
  references.some((reference) => calculateQuestionSimilarity(candidate, reference) >= QUESTION_SIMILARITY_THRESHOLD);

const formatReferenceQuestions = (items: Array<{ content: string; difficulty?: string | null }>) => {
  if (!items.length) {
    return 'Nenhuma referencia previa disponivel.';
  }

  return items
    .slice(0, 12)
    .map((item, index) => `${index + 1}. [${normalizeDifficulty(item.difficulty || 'medium')}] ${item.content}`)
    .join('\n');
};

const getSupabase = async () => {
  if (!supabaseUrl || !supabaseServiceKey) return null;
  if (!supabaseClientPromise) {
    supabaseClientPromise = import('@supabase/supabase-js').then(({ createClient }) => createClient(supabaseUrl, supabaseServiceKey));
  }
  return supabaseClientPromise;
};

const getPgPool = async () => {
  if (!databaseUrl) return null;
  if (!pgPoolPromise) {
    pgPoolPromise = import('pg').then(({ Pool }) => new Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false }, max: 3 }));
  }
  return pgPoolPromise;
};

const buildQuestionsPrompt = ({
  area,
  topic,
  count,
  difficulty,
  rawContent,
  alternativesCount,
  existingQuestions,
}: {
  area: string;
  topic: string;
  count: number;
  difficulty: string;
  rawContent: string;
  alternativesCount: number;
  existingQuestions: Array<{ content: string; difficulty?: string | null }>;
}) => `
ESPECIALISTA EM CONCURSOS DE SAUDE EM ANGOLA
AREA: ${area}
TOPICO: ${topic}
QUANTIDADE: ${count} questoes
DIFICULDADE: ${difficulty}
ALTERNATIVAS: ${alternativesCount}
CONTEXTO ADICIONAL: ${rawContent || 'Nenhum'}
GUIA DE DIFICULDADE: ${getDifficultyInstruction(difficulty)}

QUESTOES JA EXISTENTES NESTE TOPICO. NAO REPITA, NAO REESCREVA E NAO CRIE VARIACOES MUITO PARECIDAS:
${formatReferenceQuestions(existingQuestions)}

REGRAS IMPORTANTES:
- Use portugues de Angola correto
- Crie perguntas realistas para concursos publicos de saude
- A dificuldade precisa refletir claramente o nivel pedido
- Apenas uma alternativa deve estar correta
- Inclua explicacoes claras para cada pergunta
- Evite enunciados que reaproveitem o mesmo caso clinico, a mesma regra ou a mesma formulacao das referencias acima
- Retorne JSON puro, sem markdown

RETORNE APENAS:
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
      "explanation": "Explicacao detalhada",
      "difficulty": "${difficulty}",
      "is_contest_highlight": false
    }
  ]
}
`;

const normalizeQuestions = (rawQuestions: IncomingQuestion[] = []): NormalizedQuestion[] => rawQuestions.map((q) => ({
  question: String(q.question || q.content || '').trim(),
  alternatives: (q.alternatives || []).map((alt) => ({
    text: String(alt.text || alt.content || '').trim(),
    isCorrect: typeof alt.isCorrect === 'boolean' ? alt.isCorrect : Boolean(alt.is_correct),
  })),
  explanation: String(q.explanation || '').trim(),
  difficulty: normalizeDifficulty(q.difficulty),
  is_contest_highlight: Boolean(q.is_contest_highlight),
}));

const validateQuestions = (questions: NormalizedQuestion[], expectedAlternatives: number) => {
  const errors: string[] = [];
  if (!questions.length) {
    errors.push('Nenhuma pergunta foi gerada');
    return errors;
  }

  const seenQuestions = new Set<string>();
  const seenQuestionContents: string[] = [];
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

    const questionKey = normalizeQuestionIdentity(question.question);
    if (seenQuestions.has(questionKey)) {
      errors.push(`Q${index + 1}: enunciado duplicado`);
    }
    if (isNearDuplicateQuestion(question.question, seenQuestionContents)) {
      errors.push(`Q${index + 1}: enunciado demasiado parecido com outra questao do mesmo lote`);
    }
    seenQuestions.add(questionKey);
    seenQuestionContents.push(question.question);
  });

  return errors;
};

const fetchExistingTopicQuestionsWithPg = async (client: PgClient, topicId: string) => {
  const result = await client.query(
    'select content, difficulty from public.questions where topic_id = $1 order by created_at desc limit $2',
    [topicId, MAX_REFERENCE_QUESTIONS]
  );
  return result.rows as Array<{ content: string; difficulty?: string | null }>;
};

const fetchExistingTopicQuestionsWithSupabase = async (topicId: string) => {
  const supabase = await getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('questions')
    .select('content,difficulty')
    .eq('topic_id', topicId)
    .order('created_at', { ascending: false })
    .limit(MAX_REFERENCE_QUESTIONS);

  if (error) throw error;
  return (data || []) as Array<{ content: string; difficulty?: string | null }>;
};

const fetchExistingTopicQuestions = async (
  areaId: string,
  topicId?: string | null,
  customTopicName?: string | null
) => {
  const pool = await getPgPool();

  if (pool) {
    const client = await pool.connect();
    try {
      let resolvedTopicId = topicId || null;

      if (!resolvedTopicId) {
        const topicName = String(customTopicName || '').trim();
        if (!topicName) return [];

        const existingTopic = await client.query(
          'select id from public.topics where area_id = $1 and lower(name) = lower($2) limit 1',
          [areaId, topicName]
        );
        resolvedTopicId = (existingTopic.rows[0]?.id as string | undefined) || null;
      }

      if (!resolvedTopicId) return [];
      return await fetchExistingTopicQuestionsWithPg(client, resolvedTopicId);
    } finally {
      client.release();
    }
  }

  const supabase = await getSupabase();
  if (!supabase) return [];

  let resolvedTopicId = topicId || null;

  if (!resolvedTopicId) {
    const topicName = String(customTopicName || '').trim();
    if (!topicName) return [];

    const existing = await supabase
      .from('topics')
      .select('id')
      .eq('area_id', areaId)
      .ilike('name', topicName)
      .limit(1)
      .maybeSingle();

    if (existing.error) throw existing.error;
    resolvedTopicId = existing.data?.id || null;
  }

  if (!resolvedTopicId) return [];
  return fetchExistingTopicQuestionsWithSupabase(resolvedTopicId);
};

const getErrorMessage = (error: unknown) => {
  if (!(error instanceof Error)) return 'Falha desconhecida ao comunicar com a IA.';
  const message = error.message;
  if (message.toLowerCase().includes('reported as leaked')) {
    return 'A chave do Gemini foi bloqueada por vazamento. Gere uma nova chave no Google AI Studio e atualize GEMINI_API_KEY/VITE_GEMINI_API_KEY.';
  }
  if (message.includes('RESOURCE_EXHAUSTED') || message.includes('"code":429')) return 'A quota do Gemini acabou. Tente novamente mais tarde.';
  if (message.includes('NOT_FOUND') || (message.toLowerCase().includes('model') && message.toLowerCase().includes('not found'))) {
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

  const inserted = await client.query('insert into public.topics (area_id, name, description) values ($1, $2, $3) returning id', [areaId, topicName, `Topico gerado por IA: ${topicName}`]);
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
    const knownQuestions = (await fetchExistingTopicQuestionsWithPg(client, topicId)).map((item) => item.content);

    let savedCount = 0;
    let skippedCount = 0;

    for (const question of normalized) {
      if (isNearDuplicateQuestion(question.question, knownQuestions)) {
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
      knownQuestions.push(question.question);
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
  const supabase = await getSupabase();
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
      const created = await supabase.from('topics').insert({ area_id: input.area_id, name: topicName, description: `Topico gerado por IA: ${topicName}` }).select('id').single();
      if (created.error) throw created.error;
      finalTopicId = created.data.id;
      topicCreated = true;
    }
  }

  const knownQuestions = (await fetchExistingTopicQuestionsWithSupabase(finalTopicId as string)).map((item) => item.content);

  let savedCount = 0;
  let skippedCount = 0;

  for (const question of normalized) {
    if (isNearDuplicateQuestion(question.question, knownQuestions)) {
      skippedCount += 1;
      continue;
    }

    const insertedQuestion = await supabase.from('questions').insert({
      topic_id: finalTopicId,
      area_id: input.area_id,
      content: question.question,
      difficulty: question.difficulty,
      is_contest_highlight: input.is_contest_highlight || question.is_contest_highlight,
    }).select('id').single();

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
    knownQuestions.push(question.question);
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
    const hasSupabase = Boolean(supabaseUrl && supabaseServiceKey);

    if (action === 'status') {
      return res.status(200).json({
        model: modelName,
        model_candidates: modelCandidates,
        mode: geminiApiKey ? 'server-api' : 'missing-gemini-key',
        can_generate: Boolean(geminiApiKey),
        can_save: Boolean(databaseUrl || hasSupabase),
        save_mode: databaseUrl ? 'database-url' : hasSupabase ? 'service-role' : 'missing-save-backend',
      });
    }

    if (action === 'generate') {
      if (!geminiApiKey) {
        return res.status(500).json({ error: 'Nenhuma chave Gemini configurada no servidor.' });
      }

      const { GoogleGenAI, Type } = await import('@google/genai');
      const { area_id, area_name, topic_id, topic_name, custom_topic_name, count = 5, difficulty = 'medium', context = '', is_contest_highlight = false } = req.body || {};
      const resolvedAreaName = String(area_name || '').trim();
      const resolvedTopicName = String(custom_topic_name || topic_name || '').trim();

      if (!resolvedAreaName || !resolvedTopicName) {
        return res.status(400).json({ error: 'Area e topico sao obrigatorios.' });
      }

      const alternativesCount = is_contest_highlight ? 5 : 4;
      const ai = new GoogleGenAI({ apiKey: geminiApiKey });
      const existingQuestions = hasSupabase || databaseUrl
        ? await fetchExistingTopicQuestions(area_id, topic_id, custom_topic_name)
        : [];
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
            difficulty: normalizeDifficulty(difficulty),
            rawContent: context || '',
            alternativesCount,
            existingQuestions,
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
        difficulty: normalizeDifficulty(difficulty),
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
