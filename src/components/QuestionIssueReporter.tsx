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
  const [errorMessage, setErrorMessage] = useState('');

  const canSubmit = useMemo(
    () => Boolean(props.reporterId && props.questionId && navigator.onLine),
    [props.questionId, props.reporterId]
  );

  if (!props.reporterId) {
    return null;
  }

  const closeModal = () => {
    setOpen(false);
    setSubmitting(false);
    setErrorMessage('');
    setSubmittedMessage('');
  };

  const openModal = () => {
    setOpen(true);
    setErrorMessage('');
    setSubmittedMessage('');
  };

  const handleSubmit = async () => {
    if (submitting) return;

    if (!navigator.onLine) {
      setErrorMessage('Conecte-se a internet para enviar o reporte.');
      return;
    }

    if (!canSubmit) {
      setErrorMessage('Nao foi possivel identificar a conta para enviar este reporte.');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');
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

      setDescription('');
      setSubmittedMessage('Obrigado por ajudares a melhorar o MINSA Prep. O teu reporte entrou na fila de revisao e deixa a preparacao mais forte para toda a comunidade. Continua firme.');
    } catch (error: any) {
      setErrorMessage(error?.message || 'Nao foi possivel reportar esta questao.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-lime-300/80 bg-white/75 text-lime-700 shadow-sm transition hover:bg-white hover:text-lime-800"
        aria-label="Reportar inconsistencia"
        title="Reportar inconsistencia"
      >
        <Flag className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-[2rem] border border-lime-200 bg-white shadow-2xl">
            {submittedMessage ? (
              <div className="bg-[linear-gradient(180deg,#ecfccb_0%,#dcfce7_100%)] px-6 py-7">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/80 text-lime-700 shadow-sm">
                  <ShieldAlert className="h-7 w-7" />
                </div>
                <h3 className="mt-5 text-center text-2xl font-black text-lime-800">
                  Obrigado pelo reporte
                </h3>
                <p className="mt-3 text-center text-sm leading-6 text-lime-900/85">
                  {submittedMessage}
                </p>
                <button
                  type="button"
                  onClick={closeModal}
                  className="mt-6 w-full rounded-[1.2rem] bg-[#67d300] px-5 py-3.5 text-sm font-black uppercase tracking-[0.14em] text-white shadow-[0_6px_0_0_rgba(77,124,15,0.95)] transition hover:translate-y-[1px] hover:shadow-[0_4px_0_0_rgba(77,124,15,0.95)]"
                >
                  Voltar ao estudo
                </button>
              </div>
            ) : (
              <>
                <div className="border-b border-slate-100 px-6 py-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-lime-100 text-lime-700">
                      <Flag className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-lime-700">
                        Revisao colaborativa
                      </p>
                      <h3 className="mt-1 text-xl font-black text-slate-900">
                        Encontrou um problema?
                      </h3>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-600">
                    Se o enunciado, o gabarito ou a classificacao parecerem errados, envie um reporte rapido. A revisao tecnica agradece.
                  </p>
                </div>

                <div className="space-y-4 bg-slate-50 px-6 py-6">
                  <div>
                    <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                      Tipo de problema
                    </label>
                    <select
                      value={reason}
                      onChange={(event) => setReason(event.target.value as QuestionIssueReason)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-lime-400"
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
                      placeholder="Explique rapidamente o que encontrou para acelerarmos a revisao."
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none focus:border-lime-400"
                    />
                  </div>

                  {errorMessage && (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                      {errorMessage}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-3 border-t border-slate-100 bg-white px-6 py-5 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={submitting}
                    className="rounded-2xl border border-slate-200 px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-lime-500 px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-white transition hover:bg-lime-400 disabled:opacity-50"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Enviar reporte
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
