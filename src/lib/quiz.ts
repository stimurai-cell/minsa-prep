export const shuffleArray = <T,>(items: T[]) => {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
};

export const stripAlternativePrefix = (text: string) =>
  text.replace(/^\s*[a-e]\s*[\.\)\-:]\s*/i, '').trim();

const normalizeAlternatives = (alternatives: any[] = []) =>
  alternatives.filter((alternative) => {
    const rawContent =
      typeof alternative?.content === 'string'
        ? alternative.content
        : typeof alternative?.text === 'string'
          ? alternative.text
          : '';

    return rawContent.trim().length > 0;
  });

export const isPlayableQuestion = (
  question: any,
  options?: { exactAlternativeCount?: number }
) => {
  const alternatives = normalizeAlternatives(question?.alternatives || []);
  const correctCount = alternatives.filter(
    (alternative) => alternative?.is_correct === true || alternative?.isCorrect === true
  ).length;

  if (correctCount !== 1) {
    return false;
  }

  if (options?.exactAlternativeCount) {
    return alternatives.length === options.exactAlternativeCount;
  }

  return alternatives.length === 4;
};

export const filterPlayableQuestions = (
  questions: any[],
  options?: { exactAlternativeCount?: number }
) => (questions || []).filter((question) => isPlayableQuestion(question, options));

const buildBalancedCorrectSlots = (total: number, alternativesPerQuestion: number) => {
  const slots: number[] = [];
  let lastSlot: number | null = null;

  while (slots.length < total) {
    const block = shuffleArray(
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

const rebalanceAlternativesForSession = (questions: any[]) => {
  const targetSlots = buildBalancedCorrectSlots(questions.length, 4);

  return questions.map((question, index) => {
    const normalizedAlternatives = normalizeAlternatives(question.alternatives || []).map(
      (alternative: any) => ({
        ...alternative,
        content: stripAlternativePrefix(alternative.content || alternative.text || ''),
      })
    );

    const correctAlternatives = normalizedAlternatives.filter(
      (alternative: any) =>
        alternative?.is_correct === true || alternative?.isCorrect === true
    );

    if (normalizedAlternatives.length !== 4 || correctAlternatives.length !== 1) {
      return {
        ...question,
        alternatives: shuffleArray(normalizedAlternatives),
      };
    }

    const correctAlternative = correctAlternatives[0];
    const distractors = shuffleArray(
      normalizedAlternatives.filter((alternative: any) => alternative !== correctAlternative)
    );
    const rebalanced = Array.from({ length: normalizedAlternatives.length });
    const targetSlot = targetSlots[index] ?? 0;

    rebalanced[targetSlot] = correctAlternative;

    let distractorIndex = 0;
    for (let slot = 0; slot < rebalanced.length; slot += 1) {
      if (!rebalanced[slot]) {
        rebalanced[slot] = distractors[distractorIndex];
        distractorIndex += 1;
      }
    }

    return {
      ...question,
      alternatives: rebalanced,
    };
  });
};

export const prepareQuestionSet = (questions: any[]) =>
  rebalanceAlternativesForSession(shuffleArray(questions));

export const getAlternativeLabel = (index: number) =>
  index >= 0 && index < 26 ? String.fromCharCode(97 + index) : `op${index + 1}`;

type DifficultyPreference = 'mixed' | 'easy' | 'medium' | 'hard';

const difficultyOrder: Exclude<DifficultyPreference, 'mixed'>[] = ['easy', 'medium', 'hard'];

const interleaveByTopic = (questions: any[]) => {
  const byTopic = new Map<string, any[]>();

  questions.forEach((question) => {
    const topicId = question.topic_id || 'no-topic';
    const bucket = byTopic.get(topicId) || [];
    bucket.push(question);
    byTopic.set(topicId, bucket);
  });

  const queues = [...byTopic.values()].map((bucket) => shuffleArray(bucket));
  const interleaved: any[] = [];

  while (queues.some((queue) => queue.length > 0)) {
    queues.forEach((queue) => {
      const next = queue.shift();

      if (next) {
        interleaved.push(next);
      }
    });
  }

  return interleaved;
};

export const pickQuestionsForSession = (
  questions: any[],
  count: number,
  preference: DifficultyPreference = 'mixed',
  options: { strictDifficulty?: boolean } = {}
) => {
  const prepared = interleaveByTopic(shuffleArray(questions));

  if (preference !== 'mixed') {
    const exact = prepared.filter((question) => question.difficulty === preference);

    if (options.strictDifficulty) {
      return exact.slice(0, count);
    }

    const fallback = prepared.filter((question) => question.difficulty !== preference);

    return [...exact, ...fallback].slice(0, count);
  }

  const buckets = {
    easy: prepared.filter((question) => question.difficulty === 'easy'),
    medium: prepared.filter((question) => question.difficulty === 'medium'),
    hard: prepared.filter((question) => question.difficulty === 'hard'),
  };

  const targets = {
    easy: Math.ceil(count * 0.3),
    medium: Math.ceil(count * 0.4),
    hard: Math.floor(count * 0.3),
  };

  const selected: any[] = [];

  difficultyOrder.forEach((difficulty) => {
    const bucket = buckets[difficulty];
    selected.push(...bucket.splice(0, targets[difficulty]));
  });

  const remainingPool = interleaveByTopic([
    ...buckets.easy,
    ...buckets.medium,
    ...buckets.hard,
  ]);

  if (selected.length < count) {
    selected.push(...remainingPool.slice(0, count - selected.length));
  }

  return interleaveByTopic(selected).slice(0, count);
};

export const getPerformanceLabel = (accuracy: number) => {
  if (accuracy >= 95) return 'Incrivel';
  if (accuracy >= 85) return 'Otima';
  if (accuracy >= 70) return 'Boa';
  if (accuracy >= 50) return 'Continue firme';
  return 'Vamos subir';
};

export const calculateTrainingXp = (correctAnswers: number, totalQuestions: number, durationSeconds: number) => {
  const accuracy = totalQuestions > 0 ? correctAnswers / totalQuestions : 0;
  const speedBonus = durationSeconds <= 240 ? 10 : durationSeconds <= 420 ? 6 : 2;
  const baseXp = correctAnswers * 6;
  const completionBonus = totalQuestions >= 10 ? 12 : 6;
  const accuracyBonus = accuracy >= 0.9 ? 12 : accuracy >= 0.75 ? 8 : accuracy >= 0.6 ? 4 : 0;

  return baseXp + completionBonus + accuracyBonus + speedBonus;
};

export const calculateSimulationXp = (correctAnswers: number, totalQuestions: number, durationSeconds: number) => {
  const accuracy = totalQuestions > 0 ? correctAnswers / totalQuestions : 0;
  const speedBonus = durationSeconds <= 1800 ? 18 : durationSeconds <= 2700 ? 12 : 6;
  const baseXp = correctAnswers * 8;
  const completionBonus = 22;
  const accuracyBonus = accuracy >= 0.9 ? 20 : accuracy >= 0.75 ? 14 : accuracy >= 0.6 ? 8 : 2;

  return baseXp + completionBonus + accuracyBonus + speedBonus;
};

export const formatDuration = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};
