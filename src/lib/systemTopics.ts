export interface SystemTopicCandidate {
  id: string;
  name: string;
  questionCount?: number;
  answeredCount?: number;
  domainScore?: number;
  recentlySeen?: boolean;
  priorityBoost?: number;
}

export interface SystemTopicDecision {
  topicId: string;
  topicName: string;
  explanation: string;
  strategy: 'coverage' | 'recovery' | 'rotation';
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const uniqueList = (values: string[]) => [...new Set(values.filter(Boolean))];

const shuffle = <T,>(items: T[]) => {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
};

export function chooseSystemTopic(candidates: SystemTopicCandidate[]): SystemTopicDecision | null {
  const validCandidates = candidates.filter((candidate) => (candidate.questionCount || 0) > 0);
  if (!validCandidates.length) return null;

  const ranked = validCandidates
    .map((candidate) => {
      const answeredCount = candidate.answeredCount || 0;
      const domainScore = candidate.domainScore ?? 45;
      const recentlySeenPenalty = candidate.recentlySeen ? 16 : 0;
      const newTopicBoost = answeredCount === 0 ? 22 : 0;
      const recoveryBoost = domainScore < 55 ? 18 : domainScore < 70 ? 8 : 0;
      const coverageBoost = clamp(18 - answeredCount * 2, 0, 18);
      const masteryPenalty = clamp(Math.round((domainScore - 55) / 4), 0, 12);
      const score =
        40 +
        newTopicBoost +
        recoveryBoost +
        coverageBoost +
        (candidate.priorityBoost || 0) -
        masteryPenalty -
        recentlySeenPenalty +
        Math.random() * 5;

      let strategy: SystemTopicDecision['strategy'] = 'rotation';
      let explanation = 'Rotacao automatica para cobrir toda a materia.';

      if (answeredCount === 0) {
        strategy = 'coverage';
        explanation = 'Topico novo escolhido para ampliar a cobertura do programa.';
      } else if (domainScore < 55) {
        strategy = 'recovery';
        explanation = 'Topico com maior necessidade de reforco no momento.';
      }

      return {
        candidate,
        score,
        strategy,
        explanation,
      };
    })
    .sort((left, right) => right.score - left.score);

  const shortlist = ranked.slice(0, Math.min(3, ranked.length));
  const winner = shortlist[Math.floor(Math.random() * shortlist.length)] || ranked[0];

  return {
    topicId: winner.candidate.id,
    topicName: winner.candidate.name,
    explanation: winner.explanation,
    strategy: winner.strategy,
  };
}

export function chooseSystemFocusTopics(input: {
  availableTopics: string[];
  weakTopics?: string[];
  limit?: number;
}): string[] {
  const limit = Math.max(1, input.limit || 5);
  const weakTopics = uniqueList(input.weakTopics || []);
  const availableTopics = uniqueList(input.availableTopics || []);

  const starter = weakTopics.slice(0, limit);
  if (starter.length >= limit) {
    return starter.slice(0, limit);
  }

  const remaining = shuffle(
    availableTopics.filter((topic) => !starter.includes(topic))
  ).slice(0, limit - starter.length);

  return [...starter, ...remaining].slice(0, limit);
}
