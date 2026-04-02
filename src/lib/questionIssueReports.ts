import { supabase } from './supabase';

export const QUESTION_ISSUE_REASON_OPTIONS = [
  { value: 'answer_key', label: 'Gabarito incorreto' },
  { value: 'area_mismatch', label: 'Fora da area' },
  { value: 'topic_mismatch', label: 'Fora do topico' },
  { value: 'terminology', label: 'Nomenclatura incorreta' },
  { value: 'outdated', label: 'Conteudo desatualizado' },
  { value: 'confusing', label: 'Enunciado confuso' },
  { value: 'other', label: 'Outro problema' },
] as const;

export type QuestionIssueReason = (typeof QUESTION_ISSUE_REASON_OPTIONS)[number]['value'];

export const QUESTION_ISSUE_STATUS_OPTIONS = [
  { value: 'open', label: 'Aberto' },
  { value: 'in_review', label: 'Em revisao' },
  { value: 'resolved', label: 'Resolvido' },
  { value: 'dismissed', label: 'Descartado' },
] as const;

export type QuestionIssueStatus = (typeof QUESTION_ISSUE_STATUS_OPTIONS)[number]['value'];

export type QuestionIssueAlternativeSnapshot = {
  id?: string | null;
  content: string;
  isCorrect: boolean;
};

export type QuestionIssueSnapshot = {
  content: string;
  difficulty?: string | null;
  explanation?: string | null;
  alternatives: QuestionIssueAlternativeSnapshot[];
};

export type ReportQuestionIssueInput = {
  questionId: string;
  reportedBy: string;
  reporterName?: string | null;
  areaId?: string | null;
  areaName?: string | null;
  topicId?: string | null;
  topicName?: string | null;
  questionContent: string;
  questionDifficulty?: string | null;
  explanation?: string | null;
  alternatives: QuestionIssueAlternativeSnapshot[];
  reasonCategory: QuestionIssueReason;
  description?: string | null;
};

const QUESTION_ISSUE_REASON_LABELS = Object.fromEntries(
  QUESTION_ISSUE_REASON_OPTIONS.map((option) => [option.value, option.label])
) as Record<QuestionIssueReason, string>;

const QUESTION_ISSUE_STATUS_LABELS = Object.fromEntries(
  QUESTION_ISSUE_STATUS_OPTIONS.map((option) => [option.value, option.label])
) as Record<QuestionIssueStatus, string>;

const normalizeQuestionIssueSnapshot = (input: ReportQuestionIssueInput): QuestionIssueSnapshot => ({
  content: input.questionContent,
  difficulty: input.questionDifficulty || null,
  explanation: input.explanation || null,
  alternatives: input.alternatives.map((alternative) => ({
    id: alternative.id || null,
    content: alternative.content,
    isCorrect: Boolean(alternative.isCorrect),
  })),
});

export const getQuestionIssueReasonLabel = (value: string) =>
  QUESTION_ISSUE_REASON_LABELS[value as QuestionIssueReason] || value;

export const getQuestionIssueStatusLabel = (value: string) =>
  QUESTION_ISSUE_STATUS_LABELS[value as QuestionIssueStatus] || value;

export const reportQuestionIssue = async (input: ReportQuestionIssueInput) => {
  const payload = {
    question_id: input.questionId,
    reported_by: input.reportedBy,
    reporter_name: input.reporterName || null,
    area_id: input.areaId || null,
    area_name: input.areaName || null,
    topic_id: input.topicId || null,
    topic_name: input.topicName || null,
    question_content: input.questionContent,
    question_snapshot: normalizeQuestionIssueSnapshot(input),
    reason_category: input.reasonCategory,
    description: (input.description || '').trim() || null,
  };

  const { data, error } = await supabase
    .from('question_issue_reports')
    .insert(payload)
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('Esta questao ja foi reportada por si e ainda esta em analise.');
    }
    throw new Error(error.message || 'Nao foi possivel reportar a inconsistencia.');
  }

  return data;
};
