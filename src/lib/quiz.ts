export const shuffleArray = <T,>(items: T[]) => {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
};

export const stripAlternativePrefix = (text: string) =>
  text.replace(/^\s*[a-d]\s*[\.\)\-:]\s*/i, '').trim();

export const prepareQuestionSet = (questions: any[]) =>
  shuffleArray(questions).map((question) => ({
    ...question,
    alternatives: shuffleArray(question.alternatives || []).map((alternative: any) => ({
      ...alternative,
      content: stripAlternativePrefix(alternative.content || ''),
    })),
  }));

export const getAlternativeLabel = (index: number) => ['a', 'b', 'c', 'd'][index] || '?';

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
  preference: DifficultyPreference = 'mixed'
) => {
  const prepared = interleaveByTopic(shuffleArray(questions));

  if (preference !== 'mixed') {
    const exact = prepared.filter((question) => question.difficulty === preference);
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
