import { useEffect, useMemo, useState } from 'react';
import { Flag, Loader2, RefreshCw, ShieldAlert, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { getQuestionIssueReasonLabel, getQuestionIssueStatusLabel } from '../lib/questionIssueReports';

type QuestionIssueReportRow = {
  id: string;
  question_id: string | null;
  reporter_name: string | null;
  area_name: string | null;
  topic_name: string | null;
  question_content: string;
  question_snapshot: any;
  reason_category: string;
  description: string | null;
  status: 'open' | 'in_review' | 'resolved' | 'dismissed';
  resolution_note: string | null;
  created_at: string;
  resolved_at: string | null;
};

const statusToneMap: Record<string, string> = {
  open: 'bg-rose-100 text-rose-700 border border-rose-200',
  in_review: 'bg-amber-100 text-amber-700 border border-amber-200',
  resolved: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  dismissed: 'bg-slate-100 text-slate-600 border border-slate-200',
};

const parseSnapshot = (value: any) => {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value;
};

export default function AdminQuestionReports() {
  const { profile } = useAuthStore();
  const [reports, setReports] = useState<QuestionIssueReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [updating, setUpdating] = useState(false);

  const selectedReport = reports.find((report) => report.id === selectedReportId) || null;

  const counts = useMemo(
    () =>
      reports.reduce(
        (acc, report) => {
          acc.total += 1;
          acc[report.status] += 1;
          return acc;
        },
        { total: 0, open: 0, in_review: 0, resolved: 0, dismissed: 0 }
      ),
    [reports]
  );

  const fetchReports = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('question_issue_reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      setReports((data || []) as QuestionIssueReportRow[]);
    } catch (error) {
      console.error('Erro ao carregar reports de questoes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchReports();
  }, []);

  const handleUpdateStatus = async (status: QuestionIssueReportRow['status']) => {
    if (!selectedReport) return;

    setUpdating(true);
    try {
      const payload = {
        status,
        resolution_note: resolutionNote.trim() || null,
        resolved_at: status === 'resolved' || status === 'dismissed' ? new Date().toISOString() : null,
        resolved_by: status === 'resolved' || status === 'dismissed' ? profile?.id || null : null,
      };

      const { error } = await supabase
        .from('question_issue_reports')
        .update(payload)
        .eq('id', selectedReport.id);

      if (error) throw error;

      await fetchReports();
      setSelectedReportId(null);
      setResolutionNote('');
    } catch (error: any) {
      alert(error?.message || 'Nao foi possivel atualizar o report.');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteReportedQuestion = async () => {
    if (!selectedReport?.question_id) {
      alert('Esta pergunta ja nao existe mais no banco.');
      return;
    }

    if (!window.confirm('Tem certeza? A pergunta sera removida permanentemente do banco e dos registos dependentes.')) {
      return;
    }

    setUpdating(true);
    try {
      const { error: deleteError } = await supabase
        .from('questions')
        .delete()
        .eq('id', selectedReport.question_id);

      if (deleteError) throw deleteError;

      const nextNote = resolutionNote.trim()
        ? resolutionNote.trim()
        : 'Questao removida diretamente da fila de inconsistencias.';

      const { error: updateError } = await supabase
        .from('question_issue_reports')
        .update({
          status: 'resolved',
          resolution_note: nextNote,
          resolved_at: new Date().toISOString(),
          resolved_by: profile?.id || null,
        })
        .eq('id', selectedReport.id);

      if (updateError) throw updateError;

      await fetchReports();
      setSelectedReportId(null);
      setResolutionNote('');
      alert('Questao removida e report encerrado com sucesso.');
    } catch (error: any) {
      alert(error?.message || 'Nao foi possivel remover esta questao.');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <section className="space-y-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-amber-700">
            <Flag className="h-4 w-4" />
            Fila de inconsistencias
          </div>
          <h2 className="mt-4 text-2xl font-black text-slate-900">Curadoria tecnica das questoes</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Tudo o que o utilizador reportar sobre gabarito, area, topico ou nomenclatura aparece aqui.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void fetchReports()}
          disabled={loading}
          className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-amber-600 transition hover:bg-amber-50"
        >
          <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { key: 'total', label: 'Totais', value: counts.total, tone: 'bg-slate-100 text-slate-700' },
          { key: 'open', label: 'Abertos', value: counts.open, tone: 'bg-rose-100 text-rose-700' },
          { key: 'in_review', label: 'Em revisao', value: counts.in_review, tone: 'bg-amber-100 text-amber-700' },
          { key: 'resolved', label: 'Resolvidos', value: counts.resolved, tone: 'bg-emerald-100 text-emerald-700' },
          { key: 'dismissed', label: 'Descartados', value: counts.dismissed, tone: 'bg-slate-100 text-slate-600' },
        ].map((card) => (
          <div key={card.key} className={`rounded-2xl px-4 py-4 ${card.tone}`}>
            <p className="text-[10px] font-black uppercase tracking-[0.18em]">{card.label}</p>
            <p className="mt-2 text-3xl font-black">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-4">
          {loading && reports.length === 0 && (
            <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-amber-500" />
              <p className="mt-3 font-semibold">A carregar reports de questoes...</p>
            </div>
          )}

          {!loading && reports.length === 0 && (
            <div className="rounded-[1.6rem] border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center">
              <ShieldAlert className="mx-auto h-9 w-9 text-slate-300" />
              <p className="mt-3 text-sm font-bold uppercase tracking-[0.18em] text-slate-400">
                Nenhuma inconsistencia reportada ainda
              </p>
            </div>
          )}

          {reports.map((report) => (
            <button
              key={report.id}
              type="button"
              onClick={() => {
                setSelectedReportId(report.id === selectedReportId ? null : report.id);
                setResolutionNote(report.resolution_note || '');
              }}
              className={`w-full rounded-[1.6rem] border p-5 text-left transition ${
                report.id === selectedReportId
                  ? 'border-amber-400 bg-amber-50 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${statusToneMap[report.status] || statusToneMap.open}`}>
                  {getQuestionIssueStatusLabel(report.status)}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
                  {getQuestionIssueReasonLabel(report.reason_category)}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  {new Date(report.created_at).toLocaleString('pt-PT')}
                </span>
              </div>

              <p className="mt-3 line-clamp-3 text-sm font-black leading-6 text-slate-900">
                {report.question_content}
              </p>

              <div className="mt-3 grid gap-2 text-[11px] font-semibold text-slate-500 sm:grid-cols-2">
                <span>Area: {report.area_name || 'Nao informada'}</span>
                <span>Topico: {report.topic_name || 'Nao informado'}</span>
                <span>Reportado por: {report.reporter_name || 'Utilizador autenticado'}</span>
                <span>Pergunta ativa: {report.question_id ? 'Sim' : 'Nao'}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="rounded-[1.8rem] border border-slate-200 bg-slate-50 p-5">
          {!selectedReport ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
              <Flag className="h-10 w-10 text-slate-300" />
              <p className="mt-4 text-sm font-black uppercase tracking-[0.18em] text-slate-400">
                Selecione um report
              </p>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                Aqui vai aparecer o snapshot completo da questao, o motivo do report e as acoes de moderacao.
              </p>
            </div>
          ) : (
            (() => {
              const snapshot = parseSnapshot(selectedReport.question_snapshot);
              const alternatives = Array.isArray(snapshot?.alternatives) ? snapshot.alternatives : [];

              return (
                <div className="space-y-5">
                  <div className="rounded-[1.5rem] border border-white bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${statusToneMap[selectedReport.status] || statusToneMap.open}`}>
                        {getQuestionIssueStatusLabel(selectedReport.status)}
                      </span>
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">
                        {getQuestionIssueReasonLabel(selectedReport.reason_category)}
                      </span>
                    </div>

                    <p className="mt-4 text-lg font-black leading-7 text-slate-900">
                      {selectedReport.question_content}
                    </p>

                    <div className="mt-4 grid gap-2 text-xs font-semibold text-slate-500 sm:grid-cols-2">
                      <span>Area: {selectedReport.area_name || 'Nao informada'}</span>
                      <span>Topico: {selectedReport.topic_name || 'Nao informado'}</span>
                      <span>Dificuldade: {snapshot?.difficulty || 'Nao informada'}</span>
                      <span>Estado atual: {selectedReport.question_id ? 'Ativa no banco' : 'Ja removida do banco'}</span>
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] border border-white bg-white p-5 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Descricao do utilizador</p>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {selectedReport.description || 'Sem observacao adicional.'}
                    </p>
                  </div>

                  <div className="rounded-[1.5rem] border border-white bg-white p-5 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Snapshot salvo</p>
                    <div className="mt-4 space-y-3">
                      {alternatives.map((alternative: any, index: number) => (
                        <div
                          key={`${selectedReport.id}-alt-${index}`}
                          className={`rounded-2xl border px-4 py-3 text-sm ${
                            alternative?.isCorrect
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                              : 'border-slate-200 bg-slate-50 text-slate-700'
                          }`}
                        >
                          <span className="font-black uppercase tracking-[0.14em]">
                            {String.fromCharCode(65 + index)}
                          </span>
                          <span className="ml-3">{alternative?.content || 'Alternativa vazia'}</span>
                        </div>
                      ))}
                    </div>

                    {snapshot?.explanation && (
                      <div className="mt-4 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-4 text-sm leading-6 text-sky-950/85">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-700">Explicacao salva</p>
                        <p className="mt-2 whitespace-pre-wrap">{snapshot.explanation}</p>
                      </div>
                    )}
                  </div>

                  <div className="rounded-[1.5rem] border border-white bg-white p-5 shadow-sm">
                    <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                      Nota interna de resolucao
                    </label>
                    <textarea
                      value={resolutionNote}
                      onChange={(event) => setResolutionNote(event.target.value)}
                      rows={4}
                      className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-amber-400 focus:bg-white"
                      placeholder="Registe a decisao tecnica, a fonte usada ou a acao aplicada."
                    />

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => void handleUpdateStatus('in_review')}
                        disabled={updating}
                        className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
                      >
                        Marcar em revisao
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleUpdateStatus('dismissed')}
                        disabled={updating}
                        className="rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-600 transition hover:bg-slate-200 disabled:opacity-50"
                      >
                        Descartar report
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleUpdateStatus('resolved')}
                        disabled={updating}
                        className="rounded-2xl bg-emerald-600 px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-white transition hover:bg-emerald-500 disabled:opacity-50"
                      >
                        Resolver sem apagar
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteReportedQuestion()}
                        disabled={updating || !selectedReport.question_id}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-white transition hover:bg-rose-500 disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        Remover pergunta do banco
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()
          )}
        </div>
      </div>
    </section>
  );
}
