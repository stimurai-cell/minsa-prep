import { useMemo, useState } from 'react';
import { Flag, Loader2, Send, ShieldAlert } from 'lucide-react';
import {
  QUESTION_ISSUE_REASON_OPTIONS,
  type QuestionIssueAlternativeSnapshot,
  type QuestionIssueReason,
  reportQuestionIssue,
} from '../lib/questionIssueReports';

type QuestionIssueReporterProps = {
  questionId: string;
  reporterId?: string | null;
  reporterName?: string | null;
  areaId?: string | null;
  areaName?: string | null;
  topicId?: string | null;
  topicName?: string | null;
  questionContent: string;
  questionDifficulty?: string | null;
  explanation?: string | null;
  alternatives: QuestionIssueAlternativeSnapshot[];
};

const DEFAULT_REASON = QUESTION_ISSUE_REASON_OPTIONS[0].value;

export default function QuestionIssueReporter(props: QuestionIssueReporterProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<QuestionIssueReason>(DEFAULT_REASON);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedMessage, setSubmittedMessage] = useState('');

  const canSubmit = useMemo(
    () => Boolean(props.reporterId && props.questionId && navigator.onLine),
    [props.questionId, props.reporterId]
  );

  if (!props.reporterId) {
    return null;
  }

  const handleSubmit = async () => {
    if (!canSubmit || submitting) {
      if (!navigator.onLine) {
        alert('Conecte-se a internet para reportar a inconsistencia.');
      }
      return;
    }

    setSubmitting(true);
    try {
      await reportQuestionIssue({
        questionId: props.questionId,
        reportedBy: props.reporterId,
        reporterName: props.reporterName,
        areaId: props.areaId,
        areaName: props.areaName,
        topicId: props.topicId,
        topicName: props.topicName,
        questionContent: props.questionContent,
        questionDifficulty: props.questionDifficulty,
        explanation: props.explanation,
        alternatives: props.alternatives,
        reasonCategory: reason,
        description,
      });

      setSubmittedMessage('Recebido. Esta questao entrou na fila de revisao tecnica.');
      setDescription('');
      setOpen(false);
    } catch (error: any) {
      alert(error?.message || 'Nao foi possivel reportar esta questao.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-3 rounded-[1.35rem] border border-amber-200 bg-amber-50/80 px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-700">
            Curadoria colaborativa
          </p>
          <p className="mt-1 text-sm text-amber-950/80">
            Encontrou um problema tecnico, de area ou de gabarito? Envie para revisao.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setSubmittedMessage('');
            setOpen((prev) => !prev);
          }}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-300 bg-white px-4 py-2.5 text-xs font-black uppercase tracking-[0.16em] text-amber-700 transition hover:bg-amber-100"
        >
          <Flag className="h-4 w-4" />
          Reportar inconsistencia
        </button>
      </div>

      {submittedMessage && (
        <div className="mt-3 flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{submittedMessage}</span>
        </div>
      )}

      {open && (
        <div className="mt-4 space-y-3 rounded-[1.25rem] border border-amber-200 bg-white p-4 shadow-sm">
          <div>
            <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
              Tipo de problema
            </label>
            <select
              value={reason}
              onChange={(event) => setReason(event.target.value as QuestionIssueReason)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-amber-400 focus:bg-white"
            >
              {QUESTION_ISSUE_REASON_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
              Observacao
            </label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              placeholder="Explique rapidamente onde esta o problema para a revisao ser mais rapida."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-900 outline-none focus:border-amber-400 focus:bg-white"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-white transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar para revisao
            </button>

            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={submitting}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-500 transition hover:bg-slate-50"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
