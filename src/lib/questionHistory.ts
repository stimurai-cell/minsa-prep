const QUESTION_HISTORY_PREFIX = 'minsa-prep-recent-questions';

const buildHistoryKey = (scope: string) => `${QUESTION_HISTORY_PREFIX}:${scope}`;

export const getRecentQuestionIds = (scope: string) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(buildHistoryKey(scope)) || '[]');
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
};

export const rememberQuestionIds = (scope: string, questionIds: string[], limit = 80) => {
  if (!scope || questionIds.length === 0) return;

  const next = [
    ...questionIds,
    ...getRecentQuestionIds(scope).filter((id) => !questionIds.includes(id)),
  ].slice(0, limit);

  localStorage.setItem(buildHistoryKey(scope), JSON.stringify(next));
};

export const prioritizeUnseenQuestions = <T extends { id: string }>(
  questions: T[],
  seenIds: string[]
) => {
  const seenSet = new Set(seenIds);
  const unseen = questions.filter((question) => !seenSet.has(question.id));
  const seen = questions.filter((question) => seenSet.has(question.id));
  return [...unseen, ...seen];
};
