import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import {
  appendGovernanceReferences,
  buildGovernanceReviewPrompt,
  sanitizeGovernanceReferences,
} from './_lib/questionGovernance.js';

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
};

type NormalizedQuestion = {
  question: string;
  alternatives: Array<{ text: string; isCorrect: boolean }>;
  explanation: string;
  difficulty: string;
};

type PersistInput = {
  area_id: string;
  topic_id?: string | null;
  topic_name?: string | null;
  custom_topic_name?: string | null;
  questions: IncomingQuestion[];
};

type SourceMode = 'topic' | 'material_text' | 'material_file';

type SourceFileInput = {
  name?: string | null;
  mime_type?: string | null;
  data_base64?: string | null;
};

type GeneratedPayload = {
  validation_summary?: string;
  coverage_summary?: string[];
  questions?: IncomingQuestion[];
};

type GovernanceReviewQuestion = IncomingQuestion & {
  approved?: boolean;
  review_notes?: string[];
  references?: string[];
  rejection_reason?: string;
};

type GovernanceReviewPayload = {
  reviewer_summary?: string;
  questions?: GovernanceReviewQuestion[];
};

type PreparedGenerationSource = {
  sourceMode: SourceMode;
  resolvedTheme: string;
  rawContext: string;
  validateWithWeb: boolean;
  filePart?: { uri: string; mimeType: string; name: string } | null;
  cleanup?: (() => Promise<void>) | null;
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
const EXPECTED_ALTERNATIVES = 4;
const DEFAULT_GENERATION_COUNT = 5;
const MAX_GENERATION_BATCH_SIZE = 10;
const MAX_TOTAL_GENERATION_COUNT = 100;
const MAX_GENERATION_ATTEMPTS = 2;
const MAX_SOURCE_FILE_BYTES = 3.5 * 1024 * 1024;
const GEMINI_REQUEST_TIMEOUT_MS = 45000;
const PG_CONNECTION_TIMEOUT_MS = 5000;
const ALLOWED_SOURCE_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
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

  const normalizedWithoutAccents = normalized
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (['easy', 'facil'].includes(normalizedWithoutAccents)) return 'easy';
  if (['medium', 'medio', 'normal'].includes(normalizedWithoutAccents)) return 'medium';
  if (['hard', 'dificil'].includes(normalizedWithoutAccents)) return 'hard';

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

const normalizeSourceMode = (value?: string): SourceMode => {
  if (value === 'material_text' || value === 'material_file') return value;
  return 'topic';
};

const sanitizeFilename = (value?: string | null) =>
  String(value || 'source')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || 'source';

const normalizeRequestedCount = (value?: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_GENERATION_COUNT;
  return Math.max(1, Math.min(MAX_TOTAL_GENERATION_COUNT, Math.round(parsed)));
};

const createCoverageSummary = (questions: NormalizedQuestion[]) =>
  questions
    .map((question) => question.question)
    .slice(0, 12)
    .map((question) => question.split(/[?.!]/)[0]?.trim())
    .filter(Boolean);

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

const filterUniqueQuestions = (
  questions: NormalizedQuestion[],
  options: {
    referenceQuestions?: string[];
  } = {},
) => {
  const { referenceQuestions = [] } = options;
  const uniqueQuestions: NormalizedQuestion[] = [];
  const skippedQuestions: string[] = [];
  const referenceQuestionKeys = new Set(
    referenceQuestions
      .map((question) => normalizeQuestionIdentity(question))
      .filter(Boolean),
  );
  const acceptedQuestionKeys = new Set<string>();
  const acceptedQuestionContents: string[] = [];

  questions.forEach((question, index) => {
    const questionKey = normalizeQuestionIdentity(question.question);

    if (questionKey && referenceQuestionKeys.has(questionKey)) {
      skippedQuestions.push(`Q${index + 1}: enunciado duplicado de pergunta ja existente`);
      return;
    }

    if (questionKey && acceptedQuestionKeys.has(questionKey)) {
      skippedQuestions.push(`Q${index + 1}: enunciado duplicado dentro do mesmo lote`);
      return;
    }

    if (question.question && isNearDuplicateQuestion(question.question, referenceQuestions)) {
      skippedQuestions.push(`Q${index + 1}: enunciado demasiado parecido com pergunta ja existente`);
      return;
    }

    if (question.question && isNearDuplicateQuestion(question.question, acceptedQuestionContents)) {
      skippedQuestions.push(`Q${index + 1}: enunciado demasiado parecido com outra questao do mesmo lote`);
      return;
    }

    if (questionKey) {
      acceptedQuestionKeys.add(questionKey);
    }
    if (question.question) {
      acceptedQuestionContents.push(question.question);
    }

    uniqueQuestions.push(question);
  });

  return {
    uniqueQuestions,
    skippedQuestions,
  };
};

const formatReferenceQuestions = (items: Array<{ content: string; difficulty?: string | null }>) => {
  if (!items.length) {
    return 'Nenhuma referencia previa disponivel.';
  }

  return items
    .slice(0, MAX_REFERENCE_QUESTIONS)
    .map((item, index) => `${index + 1}. [${normalizeDifficulty(item.difficulty || 'medium')}] ${item.content}`)
    .join('\n');
};

const CONTEST_STYLE_ENDINGS = ['Excepto:', 'Assinale a falsa:', 'Assinale a verdadeira:'];

const normalizePromptText = (value: string) =>
  String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();

const hasContestStyleEnding = (question: string) => {
  const normalized = normalizePromptText(question);
  return CONTEST_STYLE_ENDINGS.some((ending) => normalized.endsWith(normalizePromptText(ending)));
};

const normalizeAlternativeText = (value: string) =>
  String(value || '')
    .replace(/^\s*[a-d]\s*[\.\)\-:]\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();

const shuffleItems = <T,>(items: T[]) => {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
};

const buildBalancedCorrectSlots = (total: number, alternativesPerQuestion: number) => {
  const slots: number[] = [];
  let lastSlot: number | null = null;

  while (slots.length < total) {
    const block = shuffleItems(
      Array.from({ length: alternativesPerQuestion }, (_, index) => index)
    );

    if (lastSlot !== null && block[0] === lastSlot && block.length > 1) {
      block.push(block.shift() as number);
    }

    slots.push(...block);
    lastSlot = block[block.length - 1] ?? lastSlot;
  }

  return slots.slice(0, total);
};

const rebalanceCorrectAlternativePositions = (questions: NormalizedQuestion[]) => {
  const targetSlots = buildBalancedCorrectSlots(questions.length, EXPECTED_ALTERNATIVES);

  return questions.map((question, index) => {
    if (question.alternatives.length !== EXPECTED_ALTERNATIVES) {
      return question;
    }

    const correctAlternatives = question.alternatives.filter((alternative) => alternative.isCorrect);
    if (correctAlternatives.length !== 1) {
      return question;
    }

    const correctAlternative = correctAlternatives[0];
    const distractors = shuffleItems(
      question.alternatives.filter((alternative) => alternative !== correctAlternative)
    );
    const alternatives = Array.from({ length: question.alternatives.length }) as NormalizedQuestion['alternatives'];
    const targetSlot = targetSlots[index] ?? 0;

    alternatives[targetSlot] = correctAlternative;

    let distractorIndex = 0;
    for (let slot = 0; slot < alternatives.length; slot += 1) {
      if (!alternatives[slot]) {
        alternatives[slot] = distractors[distractorIndex];
        distractorIndex += 1;
      }
    }

    return {
      ...question,
      alternatives,
    };
  });
};

const getAlternativeLengthIssue = (question: NormalizedQuestion) => {
  const lengths = question.alternatives.map((alternative) => normalizeAlternativeText(alternative.text).length);
  const correctIndex = question.alternatives.findIndex((alternative) => alternative.isCorrect);
  if (correctIndex < 0 || lengths.length !== EXPECTED_ALTERNATIVES) return '';

  const correctLength = lengths[correctIndex];
  const distractorLengths = lengths.filter((_, index) => index !== correctIndex);
  const maxDistractorLength = Math.max(...distractorLengths, 0);
  const averageDistractorLength = distractorLengths.reduce((sum, length) => sum + length, 0) / Math.max(1, distractorLengths.length);
  const uniqueLongestCorrect = correctLength === Math.max(...lengths) && lengths.filter((length) => length === correctLength).length === 1;

  if (
    uniqueLongestCorrect
    && correctLength - maxDistractorLength >= 18
    && correctLength >= Math.ceil(averageDistractorLength * 1.35)
  ) {
    return 'a alternativa correta ficou visualmente maior do que as outras';
  }

  return '';
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
    pgPoolPromise = import('pg').then(({ Pool }) => new Pool({
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: false },
      max: 3,
      connectionTimeoutMillis: PG_CONNECTION_TIMEOUT_MS,
      idleTimeoutMillis: 10000,
      query_timeout: 30000,
    }));
  }
  return pgPoolPromise;
};

const buildQuestionsPrompt = ({
  area,
  topic,
  count,
  difficulty,
  rawContent,
  sourceMode,
  validateWithWeb,
  existingQuestions,
}: {
  area: string;
  topic: string;
  count: number;
  difficulty: string;
  rawContent: string;
  sourceMode: SourceMode;
  validateWithWeb: boolean;
  existingQuestions: Array<{ content: string; difficulty?: string | null }>;
}) => `
ESPECIALISTA EM CONCURSOS DE SAUDE EM ANGOLA
DATA ATUAL: ${new Date().toISOString().slice(0, 10)}
AREA: ${area}
TOPICO: ${topic}
QUANTIDADE: ${count} questoes
DIFICULDADE: ${difficulty}
ALTERNATIVAS: ${EXPECTED_ALTERNATIVES}
MODO DE FONTE: ${sourceMode}
VALIDACAO WEB: ${validateWithWeb ? 'ATIVA' : 'DESATIVADA'}
MATERIAL DE APOIO:
${rawContent || 'Nenhum'}
GUIA DE DIFICULDADE: ${getDifficultyInstruction(difficulty)}

QUESTOES JA EXISTENTES NESTE TOPICO. NAO REPITA, NAO REESCREVA E NAO CRIE VARIACOES MUITO PARECIDAS:
${formatReferenceQuestions(existingQuestions)}

REGRAS IMPORTANTES:
- Use portugues de Angola correto
- Crie perguntas realistas para concursos publicos de saude
- A questao precisa pertencer de forma clara a AREA e ao TOPICO declarados
- Esgote o tema ao longo do lote, cobrindo diferentes subtopicos sem repeticao
- Gere exatamente ${count} perguntas neste lote, nem mais nem menos
- A dificuldade precisa refletir claramente o nivel pedido
- Gere exatamente 4 alternativas por pergunta (A, B, C, D)
- Apenas uma alternativa deve estar correta
- Estruture o enunciado como frase afirmativa finalizada com uma destas expressoes: "Excepto:", "Assinale a falsa:" ou "Assinale a verdadeira:"
- Modele o estilo pelo padrao de concursos reais: objetivo, direto, tecnico e sem floreios desnecessarios
- Mantenha paralelismo entre as alternativas, com tamanhos visuais semelhantes; a correta nao pode ser sistematicamente a mais longa
- Inclua pelo menos um distrator visualmente plausivel com erro de escrita discreto quando isso fizer sentido e sem criar ambiguidade
- Crie distratores que confundam norma tecnica com senso comum sempre que o topico permitir
- Inclua explicacoes claras para cada pergunta
- Sempre feche a explicacao com uma base bibliografica curta e confiavel
- Nao invente leis, datas, protocolos, valores de referencia ou orientacoes clinicas
- Se a validacao web estiver ativa, confirme fatos sensiveis e privilegie informacao atualizada
- Se o material fornecido estiver desatualizado ou entrar em conflito com fonte confiavel atual, corrija antes de gerar
- Evite enunciados que reaproveitem o mesmo caso clinico, a mesma regra ou a mesma formulacao das referencias acima
- Retorne JSON puro, sem markdown

RETORNE APENAS:
{
  "validation_summary": "Como o conteudo foi validado e saneado antes da geracao",
  "coverage_summary": ["Subtema 1", "Subtema 2", "Subtema 3"],
  "questions": [
    {
      "question": "Texto da pergunta",
      "alternatives": [
        {"text": "Opcao A", "isCorrect": false},
        {"text": "Opcao B", "isCorrect": false},
        {"text": "Opcao C", "isCorrect": true},
        {"text": "Opcao D", "isCorrect": false}
      ],
      "explanation": "Explicacao detalhada",
      "difficulty": "${difficulty}"
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
}));

const validateQuestions = (
  questions: NormalizedQuestion[],
  expectedAlternatives: number,
  options: {
    expectedCount?: number;
    referenceQuestions?: string[];
  } = {},
) => {
  const errors: string[] = [];
  const { expectedCount, referenceQuestions = [] } = options;

  if (!questions.length) {
    errors.push('Nenhuma pergunta foi gerada');
    return errors;
  }

  if (typeof expectedCount === 'number' && questions.length !== expectedCount) {
    errors.push(`O lote deveria conter ${expectedCount} perguntas, mas a IA devolveu ${questions.length}`);
  }

  const seenQuestions = new Set<string>();
  const seenQuestionContents: string[] = [];
  questions.forEach((question, index) => {
    if (!question.question || question.question.length < 10) {
      errors.push(`Q${index + 1}: enunciado vazio/curto`);
    }

    if (question.question && !hasContestStyleEnding(question.question)) {
      errors.push(`Q${index + 1}: o enunciado precisa terminar com "Excepto:", "Assinale a falsa:" ou "Assinale a verdadeira:"`);
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

      const lengthIssue = getAlternativeLengthIssue(question);
      if (lengthIssue) {
        errors.push(`Q${index + 1}: ${lengthIssue}`);
      }
    }

    const questionKey = normalizeQuestionIdentity(question.question);
    if (seenQuestions.has(questionKey)) {
      errors.push(`Q${index + 1}: enunciado duplicado`);
    }
    if (isNearDuplicateQuestion(question.question, referenceQuestions)) {
      errors.push(`Q${index + 1}: enunciado demasiado parecido com pergunta já existente`);
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

const getRequestedTopicName = (topicName?: string | null, customTopicName?: string | null) =>
  String(customTopicName || topicName || '').trim();

const findTopicIdWithPg = async (
  client: PgClient,
  areaId: string,
  topicId?: string | null,
  topicName?: string | null,
  customTopicName?: string | null
) => {
  if (topicId) {
    const existingById = await client.query(
      'select id from public.topics where id = $1 and area_id = $2 limit 1',
      [topicId, areaId]
    );
    if (existingById.rows[0]?.id) {
      return existingById.rows[0].id as string;
    }
  }

  const requestedTopicName = getRequestedTopicName(topicName, customTopicName);
  if (!requestedTopicName) return null;

  const existingByName = await client.query(
    'select id from public.topics where area_id = $1 and lower(name) = lower($2) limit 1',
    [areaId, requestedTopicName]
  );

  return (existingByName.rows[0]?.id as string | undefined) || null;
};

const findTopicIdWithSupabase = async (
  supabase: any,
  areaId: string,
  topicId?: string | null,
  topicName?: string | null,
  customTopicName?: string | null
) => {
  if (topicId) {
    const existingById = await supabase
      .from('topics')
      .select('id')
      .eq('id', topicId)
      .eq('area_id', areaId)
      .limit(1)
      .maybeSingle();

    if (existingById.error) throw existingById.error;
    if (existingById.data?.id) {
      return existingById.data.id as string;
    }
  }

  const requestedTopicName = getRequestedTopicName(topicName, customTopicName);
  if (!requestedTopicName) return null;

  const existingByName = await supabase
    .from('topics')
    .select('id')
    .eq('area_id', areaId)
    .ilike('name', requestedTopicName)
    .limit(1)
    .maybeSingle();

  if (existingByName.error) throw existingByName.error;
  return existingByName.data?.id || null;
};

const fetchExistingTopicQuestions = async (
  areaId: string,
  topicId?: string | null,
  topicName?: string | null,
  customTopicName?: string | null
) => {
  const pool = await getPgPool();

  if (pool) {
    try {
      const client = await pool.connect();
      try {
        const resolvedTopicId = await findTopicIdWithPg(client, areaId, topicId, topicName, customTopicName);
        if (!resolvedTopicId) return [];
        return await fetchExistingTopicQuestionsWithPg(client, resolvedTopicId);
      } finally {
        client.release();
      }
    } catch (error) {
      if (!shouldFallbackToSupabase(error)) {
        throw error;
      }
      console.warn('[generate-questions] PostgreSQL indisponivel para leitura, usando Supabase service-role.', getErrorMessage(error));
    }
  }

  const supabase = await getSupabase();
  if (!supabase) return [];

  const resolvedTopicId = await findTopicIdWithSupabase(supabase, areaId, topicId, topicName, customTopicName);
  if (!resolvedTopicId) return [];
  return fetchExistingTopicQuestionsWithSupabase(resolvedTopicId);
};

const extractErrorInfo = (error: unknown) => {
  if (error instanceof Error) {
    const record = error as Error & { details?: string; hint?: string; code?: string };
    return {
      message: record.message || '',
      details: String(record.details || '').trim(),
      hint: String(record.hint || '').trim(),
      code: String(record.code || '').trim(),
    };
  }

  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    return {
      message: String(record.message || record.error || '').trim(),
      details: String(record.details || '').trim(),
      hint: String(record.hint || '').trim(),
      code: String(record.code || '').trim(),
    };
  }

  return {
    message: '',
    details: '',
    hint: '',
    code: '',
  };
};

const shouldFallbackToSupabase = (error: unknown) => {
  const { message, details, code } = extractErrorInfo(error);
  const normalized = `${message} ${details} ${code}`.toLowerCase();

  return (
    normalized.includes('timeout') ||
    normalized.includes('connect') ||
    normalized.includes('connection terminated') ||
    normalized.includes('econnreset') ||
    normalized.includes('enotfound') ||
    normalized.includes('etimedout') ||
    normalized.includes('econnrefused') ||
    normalized.includes('57p01') ||
    normalized.includes('57p03')
  );
};

const getErrorMessage = (error: unknown) => {
  const { message, details, hint, code } = extractErrorInfo(error);
  if (!message) return 'Falha desconhecida ao guardar ou comunicar com o servidor.';
  if (message.toLowerCase().includes('reported as leaked')) {
    return 'A chave do Gemini foi bloqueada por vazamento. Gere uma nova chave no Google AI Studio e atualize GEMINI_API_KEY/VITE_GEMINI_API_KEY.';
  }
  if (message.includes('RESOURCE_EXHAUSTED') || message.includes('"code":429')) return 'A quota do Gemini acabou. Tente novamente mais tarde.';
  if (message.includes('NOT_FOUND') || (message.toLowerCase().includes('model') && message.toLowerCase().includes('not found'))) {
    return 'O modelo Gemini configurado nao esta disponivel para esta chave. Ajuste GEMINI_MODEL para um modelo suportado.';
  }
  if (message.toLowerCase().includes('apikey') || message.toLowerCase().includes('permission')) return 'A chave do Gemini parece invalida ou sem acesso ao modelo.';
  const extraParts = [details, hint ? `Sugestao: ${hint}` : '', code ? `Codigo: ${code}` : ''].filter(Boolean);
  return [message, ...extraParts].join(' | ');
};

const shouldRetryQuestionInsertWithoutArea = (error: unknown) => {
  const { message, details, code } = extractErrorInfo(error);
  const combined = `${message} ${details}`.toLowerCase();

  return code === '42703'
    || (
      combined.includes('area_id')
      && (
        combined.includes('schema cache')
        || combined.includes('column')
        || combined.includes('not found')
        || combined.includes('does not exist')
      )
    );
};

const getModelPriority = (model: string) => {
  const normalized = String(model || '').toLowerCase();
  if (!normalized) return 99;
  if (normalized.includes('flash-lite')) return 2;
  if (normalized.includes('flash')) return 0;
  return 1;
};

const buildModelCandidates = (primaryModel: string) =>
  Array.from(new Set([primaryModel, defaultGeminiModel, 'gemini-2.5-flash'].filter(Boolean)))
    .sort((left, right) => getModelPriority(left) - getModelPriority(right));

const generateContentWithTimeout = async (
  ai: any,
  request: Record<string, unknown>,
  label: string,
  timeoutMs = GEMINI_REQUEST_TIMEOUT_MS,
) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new Error(`${label} excedeu ${Math.round(timeoutMs / 1000)}s.`)), timeoutMs);

  try {
    return await ai.models.generateContent({
      ...request,
      abortSignal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`${label} excedeu ${Math.round(timeoutMs / 1000)}s.`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

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

const decodeSourceFile = (input?: SourceFileInput | null) => {
  const mimeType = String(input?.mime_type || '').trim();
  if (!ALLOWED_SOURCE_MIME_TYPES.has(mimeType)) {
    throw new Error('Use apenas ficheiros PDF ou DOCX.');
  }

  const base64 = String(input?.data_base64 || '').trim();
  if (!base64) {
    throw new Error('O ficheiro enviado nao contem dados.');
  }

  const buffer = Buffer.from(base64, 'base64');
  if (!buffer.length) {
    throw new Error('Nao foi possivel decodificar o ficheiro enviado.');
  }

  if (buffer.length > MAX_SOURCE_FILE_BYTES) {
    throw new Error('O ficheiro excede o limite de 3.5 MB para processamento seguro.');
  }

  const originalName = sanitizeFilename(input?.name);
  const fallbackExtension = mimeType === 'application/pdf' ? '.pdf' : '.docx';
  const filename = originalName.includes('.') ? originalName : `${originalName}${fallbackExtension}`;

  return { buffer, filename, mimeType };
};

const waitForUploadedFileActive = async (ai: any, fileName?: string) => {
  if (!fileName) throw new Error('Falha ao preparar o ficheiro para a IA.');

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const current = await ai.files.get({ name: fileName });
    if (current?.state === 'ACTIVE') return current;
    if (current?.state === 'FAILED') {
      const detail = current?.error?.message || 'O Gemini nao conseguiu processar o ficheiro.';
      throw new Error(detail);
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  throw new Error('O ficheiro demorou demasiado para ficar disponivel no Gemini.');
};

const createResponseSchema = (Type: any, expectedCount: number) => ({
  type: Type.OBJECT,
  properties: {
    validation_summary: { type: Type.STRING },
    coverage_summary: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    questions: {
      type: Type.ARRAY,
      minItems: expectedCount,
      maxItems: expectedCount,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          alternatives: {
            type: Type.ARRAY,
            minItems: EXPECTED_ALTERNATIVES,
            maxItems: EXPECTED_ALTERNATIVES,
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
  required: ['validation_summary', 'coverage_summary', 'questions'],
});

const createGovernanceReviewResponseSchema = (Type: any, expectedCount: number) => ({
  type: Type.OBJECT,
  properties: {
    reviewer_summary: { type: Type.STRING },
    questions: {
      type: Type.ARRAY,
      minItems: expectedCount,
      maxItems: expectedCount,
      items: {
        type: Type.OBJECT,
        properties: {
          approved: { type: Type.BOOLEAN },
          question: { type: Type.STRING },
          alternatives: {
            type: Type.ARRAY,
            minItems: EXPECTED_ALTERNATIVES,
            maxItems: EXPECTED_ALTERNATIVES,
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
          review_notes: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          references: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          rejection_reason: { type: Type.STRING },
        },
        required: ['approved', 'question', 'alternatives', 'explanation', 'difficulty', 'review_notes', 'references', 'rejection_reason'],
      },
    },
  },
  required: ['reviewer_summary', 'questions'],
});

const reviewGeneratedBatch = async ({
  ai,
  Type,
  model,
  area,
  topic,
  sourceMode,
  validateWithWeb,
  questions,
  referenceQuestions,
}: {
  ai: any;
  Type: any;
  model: string;
  area: string;
  topic: string;
  sourceMode: SourceMode;
  validateWithWeb: boolean;
  questions: NormalizedQuestion[];
  referenceQuestions: string[];
}) => {
  if (!questions.length) {
    return {
      approvedQuestions: [] as NormalizedQuestion[],
      reviewerSummary: '',
      rejectedReasons: [] as string[],
    };
  }

  const prompt = buildGovernanceReviewPrompt({
    area,
    topic,
    sourceMode,
    validateWithWeb,
    questions,
  });

  const response = await generateContentWithTimeout(
    ai,
    {
      model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: createGovernanceReviewResponseSchema(Type, questions.length),
        tools: validateWithWeb ? ([{ type: 'google_search' }] as any) : undefined,
      },
    },
    `A revisao tecnica do modelo ${model}`,
  );

  const rawText = extractResponseText(response);
  const parsed = rawText ? (parseGeneratedPayload(rawText) as GovernanceReviewPayload) : null;
  const reviewedQuestions = Array.isArray(parsed?.questions) ? parsed.questions : [];

  if (reviewedQuestions.length !== questions.length) {
    throw new Error('A revisao tecnica devolveu uma quantidade invalida de itens.');
  }

  const approvedPayload = reviewedQuestions
    .filter((item) => Boolean(item?.approved))
    .map((item) => ({
      question: String(item.question || item.content || '').trim(),
      alternatives: (item.alternatives || []).map((alternative) => ({
        text: String(alternative.text || alternative.content || '').trim(),
        isCorrect: typeof alternative.isCorrect === 'boolean' ? alternative.isCorrect : Boolean(alternative.is_correct),
      })),
      explanation: appendGovernanceReferences(
        String(item.explanation || '').trim(),
        sanitizeGovernanceReferences(item.references)
      ),
      difficulty: String(item.difficulty || '').trim(),
    }));

  const approvedQuestions = normalizeQuestions(approvedPayload);
  const reviewValidationErrors = approvedQuestions.length
    ? validateQuestions(approvedQuestions, EXPECTED_ALTERNATIVES, { referenceQuestions })
    : [];

  if (reviewValidationErrors.length) {
    throw new Error(`A revisao tecnica devolveu perguntas invalidas: ${reviewValidationErrors.join('; ')}`);
  }

  const rejectedReasons = reviewedQuestions
    .map((item, index) =>
      item?.approved
        ? ''
        : `Q${index + 1}: ${String(item?.rejection_reason || 'A revisao tecnica reprovou esta questao.').trim()}`
    )
    .filter(Boolean);

  return {
    approvedQuestions,
    reviewerSummary: String(parsed?.reviewer_summary || '').trim(),
    rejectedReasons,
  };
};

const mergeCoverageSummary = (current: string[], incoming: unknown) => {
  if (!Array.isArray(incoming)) return current;

  const merged = new Set(current);
  incoming
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .forEach((item) => merged.add(item));

  return Array.from(merged).slice(0, 24);
};

const prepareGenerationSource = async (
  body: any,
  ai: any,
): Promise<PreparedGenerationSource> => {
  const sourceMode = normalizeSourceMode(body?.source_mode);
  const resolvedTheme = String(body?.source_theme || body?.custom_topic_name || body?.topic_name || '').trim();
  const validateWithWeb = Boolean(body?.validate_with_web) || sourceMode !== 'topic';
  const baseContext = String(body?.context || '').trim();

  if (sourceMode === 'material_text') {
    const sourceText = String(body?.source_text || '').trim();
    if (!sourceText) {
      throw new Error('Cole a materia completa para gerar questoes por texto.');
    }

    return {
      sourceMode,
      resolvedTheme,
      rawContext: sourceText,
      validateWithWeb,
      filePart: null,
      cleanup: null,
    };
  }

  if (sourceMode === 'material_file') {
    const { buffer, filename, mimeType } = decodeSourceFile(body?.source_file);
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'minsa-source-'));
    const tempFilePath = path.join(tempDir, filename);
    await fs.writeFile(tempFilePath, buffer);

    const uploaded = await ai.files.upload({
      file: tempFilePath,
      config: { mimeType },
    });
    const activeFile = await waitForUploadedFileActive(ai, uploaded?.name);

    return {
      sourceMode,
      resolvedTheme,
      rawContext: baseContext,
      validateWithWeb,
      filePart: {
        uri: activeFile.uri || '',
        mimeType: activeFile.mimeType || mimeType,
        name: filename,
      },
      cleanup: async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
      },
    };
  }

  return {
    sourceMode,
    resolvedTheme,
    rawContext: baseContext,
    validateWithWeb,
    filePart: null,
    cleanup: null,
  };
};

const insertQuestionWithPostgres = async (
  client: PgClient,
  input: PersistInput,
  topicId: string,
  question: NormalizedQuestion,
) => {
  try {
    return await client.query(
      'insert into public.questions (topic_id, area_id, content, difficulty) values ($1, $2, $3, $4) returning id',
      [topicId, input.area_id, question.question, question.difficulty],
    );
  } catch (error) {
    if (!shouldRetryQuestionInsertWithoutArea(error)) throw error;

    return client.query(
      'insert into public.questions (topic_id, content, difficulty) values ($1, $2, $3) returning id',
      [topicId, question.question, question.difficulty],
    );
  }
};

const insertQuestionWithSupabase = async (
  supabase: any,
  input: PersistInput,
  topicId: string,
  question: NormalizedQuestion,
) => {
  const basePayload = {
    topic_id: topicId,
    content: question.question,
    difficulty: question.difficulty,
  };

  let insertedQuestion = await supabase
    .from('questions')
    .insert({
      ...basePayload,
      area_id: input.area_id,
    })
    .select('id')
    .single();

  if (insertedQuestion.error && shouldRetryQuestionInsertWithoutArea(insertedQuestion.error)) {
    insertedQuestion = await supabase
      .from('questions')
      .insert(basePayload)
      .select('id')
      .single();
  }

  if (insertedQuestion.error) throw insertedQuestion.error;
  return insertedQuestion;
};

const resolveTopicWithPg = async (
  client: PgClient,
  areaId: string,
  topicId?: string | null,
  topicName?: string | null,
  customTopicName?: string | null
) => {
  const resolvedTopicId = await findTopicIdWithPg(client, areaId, topicId, topicName, customTopicName);
  if (resolvedTopicId) return { topicId: resolvedTopicId, topicCreated: false };

  const requestedTopicName = getRequestedTopicName(topicName, customTopicName);
  if (!requestedTopicName) throw new Error('Area e topico sao obrigatorios.');

  const inserted = await client.query(
    'insert into public.topics (area_id, name, description) values ($1, $2, $3) returning id',
    [areaId, requestedTopicName, `Topico gerado por IA: ${requestedTopicName}`]
  );
  return { topicId: inserted.rows[0].id as string, topicCreated: true };
};

const persistWithPostgres = async (input: PersistInput): Promise<PersistResult> => {
  const pool = await getPgPool();
  if (!pool) throw new Error('DATABASE_URL nao configurada.');

  const client = await pool.connect();
  try {
    const normalized = normalizeQuestions(input.questions);
    const validationErrors = validateQuestions(normalized, EXPECTED_ALTERNATIVES);
    if (validationErrors.length) {
      throw new Error(`Perguntas invalidas para guardar: ${validationErrors.join('; ')}`);
    }

    await client.query('BEGIN');
    const { topicId, topicCreated } = await resolveTopicWithPg(
      client,
      input.area_id,
      input.topic_id,
      input.topic_name,
      input.custom_topic_name
    );
    const knownQuestions = (await fetchExistingTopicQuestionsWithPg(client, topicId)).map((item) => item.content);

    let savedCount = 0;
    let skippedCount = 0;

    for (const question of normalized) {
      if (isNearDuplicateQuestion(question.question, knownQuestions)) {
        skippedCount += 1;
        continue;
      }

      const insertedQuestion = await insertQuestionWithPostgres(client, input, topicId, question);

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
  const validationErrors = validateQuestions(normalized, EXPECTED_ALTERNATIVES);
  if (validationErrors.length) {
    throw new Error(`Perguntas invalidas para guardar: ${validationErrors.join('; ')}`);
  }

  let finalTopicId = await findTopicIdWithSupabase(
    supabase,
    input.area_id,
    input.topic_id,
    input.topic_name,
    input.custom_topic_name
  );
  let topicCreated = false;

  if (!finalTopicId) {
    const requestedTopicName = getRequestedTopicName(input.topic_name, input.custom_topic_name);
    if (!requestedTopicName) throw new Error('Area e topico sao obrigatorios.');

    const created = await supabase
      .from('topics')
      .insert({
        area_id: input.area_id,
        name: requestedTopicName,
        description: `Topico gerado por IA: ${requestedTopicName}`,
      })
      .select('id')
      .single();

    if (created.error) throw created.error;
    finalTopicId = created.data.id;
    topicCreated = true;
  }

  const knownQuestions = (await fetchExistingTopicQuestionsWithSupabase(finalTopicId as string)).map((item) => item.content);

  let savedCount = 0;
  let skippedCount = 0;

  for (const question of normalized) {
    if (isNearDuplicateQuestion(question.question, knownQuestions)) {
      skippedCount += 1;
      continue;
    }

    const insertedQuestion = await insertQuestionWithSupabase(supabase, input, finalTopicId as string, question);

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

      const { GoogleGenAI, Type, createPartFromText, createPartFromUri } = await import('@google/genai');
      const { area_id, area_name, topic_id, topic_name, custom_topic_name, count = DEFAULT_GENERATION_COUNT, difficulty = 'medium' } = req.body || {};
      const resolvedAreaId = String(area_id || '').trim();
      const resolvedAreaName = String(area_name || '').trim();
      const requestedTopicName = String(custom_topic_name || topic_name || '').trim();
      const requestedCount = normalizeRequestedCount(count);

      if (!resolvedAreaId || !resolvedAreaName || !requestedTopicName) {
        return res.status(400).json({ error: 'Area e topico sao obrigatorios.' });
      }

      const ai = new GoogleGenAI({ apiKey: geminiApiKey });
      const preparedSource = await prepareGenerationSource(req.body || {}, ai);
      const resolvedTheme = preparedSource.resolvedTheme || requestedTopicName;
      const existingQuestions = hasSupabase || databaseUrl
        ? await fetchExistingTopicQuestions(resolvedAreaId, topic_id, topic_name, custom_topic_name)
        : [];
      let normalized: NormalizedQuestion[] = [];
      let validationErrors: string[] = [];
      let modelUsed = modelCandidates[0];
      let coverageSummary: string[] = [];
      let validationSummaryParts: string[] = [];
      let lastError: unknown = null;

      try {
        for (const candidateModel of modelCandidates) {
          let candidateValidationErrors: string[] = [];
          try {
            const candidateQuestions: NormalizedQuestion[] = [];
            let candidateCoverageSummary: string[] = [];
            const candidateValidationSummaryParts: string[] = [];

            while (candidateQuestions.length < requestedCount) {
              const remainingCount = requestedCount - candidateQuestions.length;
              const batchCount = Math.min(MAX_GENERATION_BATCH_SIZE, remainingCount);
              const referenceQuestions = [
                ...existingQuestions.map((item) => item.content),
                ...candidateQuestions.map((question) => question.question),
              ];
              const prompt = buildQuestionsPrompt({
                area: resolvedAreaName,
                topic: resolvedTheme,
                count: batchCount,
                difficulty: normalizeDifficulty(difficulty),
                rawContent: preparedSource.rawContext,
                sourceMode: preparedSource.sourceMode,
                validateWithWeb: preparedSource.validateWithWeb,
                existingQuestions: [
                  ...candidateQuestions.map((question) => ({
                    content: question.question,
                    difficulty: question.difficulty,
                  })),
                  ...existingQuestions,
                ].slice(0, MAX_REFERENCE_QUESTIONS),
              });

              const contents = preparedSource.filePart
                ? [{
                  role: 'user',
                  parts: [
                    createPartFromText(prompt),
                    createPartFromUri(preparedSource.filePart.uri, preparedSource.filePart.mimeType),
                  ],
                }]
                : prompt;

              candidateValidationErrors = [];

              for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt += 1) {
                const response = await generateContentWithTimeout(
                  ai,
                  {
                    model: candidateModel,
                    contents,
                    config: {
                      responseMimeType: 'application/json',
                      responseSchema: createResponseSchema(Type, batchCount),
                      tools: preparedSource.validateWithWeb ? ([{ type: 'google_search' }] as any) : undefined,
                    },
                  },
                  `A geracao do modelo ${candidateModel}`,
                );
                const rawText = extractResponseText(response);
                const parsedBatch = rawText ? parseGeneratedPayload(rawText) : null;
                const normalizedBatch = normalizeQuestions(parsedBatch?.questions || []);
                const filteredBatch = filterUniqueQuestions(normalizedBatch, {
                  referenceQuestions,
                });
                const uniqueBatch = filteredBatch.uniqueQuestions;

                candidateValidationErrors = uniqueBatch.length
                  ? validateQuestions(uniqueBatch, EXPECTED_ALTERNATIVES, { referenceQuestions })
                  : [
                    filteredBatch.skippedQuestions.length
                      ? 'A IA devolveu apenas perguntas repetidas nesta tentativa.'
                      : 'Nenhuma pergunta valida foi gerada nesta tentativa.',
                  ];

                if (!candidateValidationErrors.length) {
                  const reviewedBatch = await reviewGeneratedBatch({
                    ai,
                    Type,
                    model: candidateModel,
                    area: resolvedAreaName,
                    topic: resolvedTheme,
                    sourceMode: preparedSource.sourceMode,
                    validateWithWeb: preparedSource.validateWithWeb,
                    questions: uniqueBatch,
                    referenceQuestions,
                  });

                  if (!reviewedBatch.approvedQuestions.length) {
                    candidateValidationErrors = reviewedBatch.rejectedReasons.length
                      ? reviewedBatch.rejectedReasons
                      : ['A revisao tecnica reprovou todas as perguntas desta tentativa.'];
                    continue;
                  }

                  const balancedBatch = rebalanceCorrectAlternativePositions(reviewedBatch.approvedQuestions);
                  candidateQuestions.push(...balancedBatch);
                  candidateCoverageSummary = mergeCoverageSummary(candidateCoverageSummary, parsedBatch?.coverage_summary);
                  const validationSummary = String(parsedBatch?.validation_summary || '').trim();
                  if (validationSummary) {
                    candidateValidationSummaryParts.push(validationSummary);
                  }
                  if (reviewedBatch.reviewerSummary) {
                    candidateValidationSummaryParts.push(reviewedBatch.reviewerSummary);
                  }
                  if (filteredBatch.skippedQuestions.length) {
                    candidateValidationSummaryParts.push(
                      `${filteredBatch.skippedQuestions.length} perguntas repetidas foram descartadas automaticamente nesta rodada.`
                    );
                  }
                  if (reviewedBatch.rejectedReasons.length) {
                    candidateValidationSummaryParts.push(
                      `${reviewedBatch.rejectedReasons.length} perguntas foram bloqueadas pela revisao tecnica por risco de erro ou inadequacao area-topico.`
                    );
                  }
                  break;
                }

                console.warn(
                  '[generate-questions] validation failed attempt',
                  attempt,
                  candidateModel,
                  `batch=${batchCount}`,
                  candidateValidationErrors,
                  filteredBatch.skippedQuestions,
                );
              }

              if (candidateValidationErrors.length) {
                break;
              }
            }

            if (!candidateValidationErrors.length && candidateQuestions.length === requestedCount) {
              normalized = candidateQuestions;
              coverageSummary = candidateCoverageSummary;
              validationSummaryParts = candidateValidationSummaryParts;
              validationErrors = [];
              modelUsed = candidateModel;
              break;
            }
          } catch (error) {
            lastError = error;
            console.warn('[generate-questions] model failed', candidateModel, getErrorMessage(error));
            continue;
          }

          if (!normalized.length) {
            validationErrors = candidateValidationErrors.length
              ? candidateValidationErrors
              : [`Nao foi possivel completar o lote de ${requestedCount} perguntas com o modelo ${candidateModel}.`];
          }

          if (normalized.length === requestedCount) {
            break;
          }
        }

        if (!normalized.length && !validationErrors.length && lastError) {
          throw lastError;
        }

        if (!normalized.length) {
          return res.status(422).json({
            error: `A IA nao conseguiu fechar ${requestedCount} perguntas validas apos varias tentativas.`,
            validation_errors: validationErrors,
          });
        }

        if (validationErrors.length || normalized.length !== requestedCount) {
          return res.status(422).json({
            error: `A IA nao conseguiu entregar exatamente ${requestedCount} perguntas validas.`,
            validation_errors: validationErrors,
          });
        }

        return res.status(200).json({
          area_id: resolvedAreaId,
          area_name: resolvedAreaName,
          topic_id,
          topic_name,
          custom_topic_name,
          count: requestedCount,
          difficulty: normalizeDifficulty(difficulty),
          model_used: modelUsed,
          source_mode: preparedSource.sourceMode,
          source_theme: resolvedTheme,
          validate_with_web: preparedSource.validateWithWeb,
          validation_summary: Array.from(new Set(validationSummaryParts.filter(Boolean))).join(' ')
            || (preparedSource.validateWithWeb
              ? 'Conteudo consolidado com validacao web e revisao tecnica por area antes da montagem final das questoes.'
              : 'Conteudo estruturado a partir do topico, seguido de revisao tecnica por area antes da aprovacao final.'),
          coverage_summary: coverageSummary.length ? coverageSummary : createCoverageSummary(normalized),
          questions: normalized,
        });
      } finally {
        if (preparedSource.cleanup) {
          await preparedSource.cleanup();
        }
      }
    }

    if (action === 'save') {
      const { generated_data } = req.body || {};
      if (!generated_data?.questions) {
        return res.status(400).json({ error: 'Dados gerados sao obrigatorios.' });
      }

      const payload: PersistInput = {
        area_id: generated_data.area_id,
        topic_id: generated_data.topic_id,
        topic_name: generated_data.topic_name,
        custom_topic_name: generated_data.custom_topic_name,
        questions: generated_data.questions,
      };

      if (!payload.area_id || (!payload.topic_id && !payload.topic_name && !payload.custom_topic_name)) {
        return res.status(400).json({ error: 'Area e topico sao obrigatorios.' });
      }

      let result: PersistResult;

      if (databaseUrl) {
        try {
          result = await persistWithPostgres(payload);
        } catch (error) {
          if (!hasSupabase || !shouldFallbackToSupabase(error)) {
            throw error;
          }
          console.warn('[generate-questions] PostgreSQL indisponivel para escrita, usando Supabase service-role.', getErrorMessage(error));
          result = await persistWithSupabase(payload);
        }
      } else {
        result = await persistWithSupabase(payload);
      }

      return res.status(200).json({
        success: true,
        topic_id: result.topicId,
        topic_created: result.topicCreated,
        saved_count: result.savedCount,
        skipped_count: result.skippedCount,
        save_mode: databaseUrl ? 'database-url-or-service-role' : 'service-role',
      });
    }

    return res.status(400).json({ error: 'Acao invalida.' });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: getErrorMessage(error) });
  }
}

export const _validateQuestionsForTest = validateQuestions;
