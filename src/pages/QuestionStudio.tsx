import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, CheckCircle2, Plus, ShieldCheck, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useAppStore } from '../store/useAppStore';

type QuestionFormDraft = {
  content: string;
  difficulty: string;
  explanation: string;
  examYear: string;
  alternatives: Array<{ id: string; content: string; is_correct: boolean }>;
};

const createEmptyQuestionDraft = (): QuestionFormDraft => ({
  content: '',
  difficulty: 'medium',
  explanation: '',
  examYear: '',
  alternatives: Array.from({ length: 4 }, (_, index) => ({
    id: `manual-${index}`,
    content: '',
    is_correct: index === 0,
  })),
});

const normalizeExamYear = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const year = Number(trimmed);
  if (!Number.isInteger(year) || year < 1900 || year > 2100) return Number.NaN;
  return year;
};

const shouldRetryQuestionInsertWithoutAreaClient = (error: any) => {
  const message = String(error?.message || '').toLowerCase();
  const details = String(error?.details || '').toLowerCase();
  const code = String(error?.code || '').toLowerCase();
  const combined = `${message} ${details} ${code}`;

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

const validateQuestionDraft = (draft: QuestionFormDraft) => {
  if (draft.content.trim().length < 10) {
    return 'Escreva um enunciado mais completo para a questao.';
  }

  if (draft.alternatives.length !== 4) {
    return 'Cada questao precisa ter exatamente 4 alternativas.';
  }

  if (draft.alternatives.some((alternative) => alternative.content.trim().length < 2)) {
    return 'Preencha as quatro alternativas antes de guardar.';
  }

  const correctCount = draft.alternatives.filter((alternative) => alternative.is_correct).length;
  if (correctCount !== 1) {
    return 'Defina exatamente uma alternativa correta.';
  }

  const normalizedAlternatives = draft.alternatives.map((alternative) => alternative.content.trim().toLowerCase());
  if (new Set(normalizedAlternatives).size !== normalizedAlternatives.length) {
    return 'As alternativas devem ser diferentes entre si.';
  }

  const examYear = normalizeExamYear(draft.examYear);
  if (Number.isNaN(examYear)) {
    return 'Informe um ano de concurso valido ou deixe o campo vazio.';
  }

  return null;
};

const getAlternativeBadge = (index: number) => String.fromCharCode(65 + index);

export default function QuestionStudio() {
  const { profile } = useAuthStore();
  const { areas, topics, fetchAreas, fetchTopics } = useAppStore();
  const canAuthor = profile?.role === 'elite' || profile?.role === 'admin';
  const [selectedAreaId, setSelectedAreaId] = useState(profile?.selected_area_id || '');
  const [selectedTopicId, setSelectedTopicId] = useState('');
  const [draft, setDraft] = useState<QuestionFormDraft>(createEmptyQuestionDraft());
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [recentQuestions, setRecentQuestions] = useState<any[]>([]);

  useEffect(() => {
    void fetchAreas();
  }, [fetchAreas]);

  useEffect(() => {
    if (!selectedAreaId && profile?.selected_area_id) {
      setSelectedAreaId(profile.selected_area_id);
    }
  }, [profile?.selected_area_id, selectedAreaId]);

  useEffect(() => {
    if (!selectedAreaId) {
      setSelectedTopicId('');
      setEditorOpen(false);
      setRecentQuestions([]);
      return;
    }

    void fetchTopics(selectedAreaId);
  }, [fetchTopics, selectedAreaId]);

  useEffect(() => {
    if (selectedTopicId && !topics.some((topic) => topic.id === selectedTopicId)) {
      setSelectedTopicId('');
      setEditorOpen(false);
      setRecentQuestions([]);
    }
  }, [selectedTopicId, topics]);

  const selectedArea = useMemo(
    () => areas.find((area) => area.id === selectedAreaId) || null,
    [areas, selectedAreaId]
  );

  const selectedTopic = useMemo(
    () => topics.find((topic) => topic.id === selectedTopicId) || null,
    [selectedTopicId, topics]
  );

  const loadRecentQuestions = async (topicId: string) => {
    const { data, error } = await supabase
      .from('questions')
      .select('id, content, difficulty, created_at')
      .eq('topic_id', topicId)
      .order('created_at', { ascending: false })
      .limit(6);

    if (error) {
      console.error('Nao foi possivel carregar as questoes recentes:', error);
      setRecentQuestions([]);
      return;
    }

    setRecentQuestions(data || []);
  };

  useEffect(() => {
    if (!selectedTopicId) {
      setRecentQuestions([]);
      return;
    }

    void loadRecentQuestions(selectedTopicId);
  }, [selectedTopicId]);

  const handleAlternativeChange = (index: number, value: string) => {
    const alternatives = [...draft.alternatives];
    alternatives[index] = { ...alternatives[index], content: value };
    setDraft({ ...draft, alternatives });
  };

  const handleMarkCorrectAlternative = (id: string) => {
    setDraft({
      ...draft,
      alternatives: draft.alternatives.map((alternative) => ({
        ...alternative,
        is_correct: alternative.id === id,
      })),
    });
  };

  const handleOpenEditor = () => {
    if (!selectedAreaId || !selectedTopicId) return;
    setSuccessMessage('');
    setEditorOpen(true);
  };

  const handleCreateQuestion = async () => {
    if (!selectedAreaId || !selectedTopic) {
      window.alert('Escolha primeiro a area e o topico.');
      return;
    }

    const validationError = validateQuestionDraft(draft);
    if (validationError) {
      window.alert(validationError);
      return;
    }

    const examYear = normalizeExamYear(draft.examYear);
    let insertedQuestionId: string | null = null;

    setSaving(true);
    try {
      const basePayload = {
        topic_id: selectedTopic.id,
        content: draft.content.trim(),
        difficulty: draft.difficulty,
        exam_year: examYear,
      };

      let insertedQuestion = await supabase
        .from('questions')
        .insert({
          ...basePayload,
          area_id: selectedAreaId,
        })
        .select('id')
        .single();

      if (insertedQuestion.error && shouldRetryQuestionInsertWithoutAreaClient(insertedQuestion.error)) {
        insertedQuestion = await supabase
          .from('questions')
          .insert(basePayload)
          .select('id')
          .single();
      }

      if (insertedQuestion.error || !insertedQuestion.data?.id) {
        throw insertedQuestion.error || new Error('Nao foi possivel criar a questao manualmente.');
      }

      insertedQuestionId = insertedQuestion.data.id;

      const { error: alternativesError } = await supabase
        .from('alternatives')
        .insert(
          draft.alternatives.map((alternative) => ({
            question_id: insertedQuestionId,
            content: alternative.content.trim(),
            is_correct: alternative.is_correct,
          }))
        );

      if (alternativesError) throw alternativesError;

      if (draft.explanation.trim()) {
        const { error: explanationError } = await supabase
          .from('question_explanations')
          .insert({
            question_id: insertedQuestionId,
            content: draft.explanation.trim(),
          });

        if (explanationError) throw explanationError;
      }

      setDraft(createEmptyQuestionDraft());
      setSuccessMessage('Questao criada com sucesso. Ja podes inserir a proxima.');
      await loadRecentQuestions(selectedTopic.id);
    } catch (error: any) {
      if (insertedQuestionId) {
        await supabase.from('questions').delete().eq('id', insertedQuestionId);
      }

      window.alert(error?.message || 'Falha ao criar a questao manual.');
    } finally {
      setSaving(false);
    }
  };

  if (!canAuthor) {
    return (
      <div className="mx-auto max-w-3xl pb-24">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 text-rose-600">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <h1 className="mt-5 text-2xl font-black text-slate-900">Acesso restrito</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Esta area de criacao manual esta disponivel apenas para contas Elite e Admin.
          </p>
          <Link
            to="/dashboard"
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-white transition hover:bg-emerald-500"
          >
            Voltar ao painel
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-24">
      <section className="overflow-hidden rounded-[2.2rem] border border-emerald-200 bg-[radial-gradient(circle_at_top_left,#dff7ea,transparent_34%),linear-gradient(135deg,#ffffff_0%,#f7fff9_46%,#eff6ff_100%)] p-6 shadow-[0_28px_90px_-52px_rgba(15,23,42,0.42)] md:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-700">Criacao Manual</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
              Criar questoes uma a uma
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Escolhe a area, define o topico e abre o editor para escrever o enunciado, as 4 alternativas e a resposta correta manualmente.
            </p>
          </div>

          <div className="rounded-[1.8rem] border border-white/80 bg-white/90 p-4 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Fluxo</p>
            <div className="mt-3 space-y-2 text-sm font-semibold text-slate-700">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-xs font-black text-emerald-700">1</span>
                Escolher area
              </div>
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-xs font-black text-emerald-700">2</span>
                Escolher topico
              </div>
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-xs font-black text-emerald-700">3</span>
                Clicar em criar questao
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Destino</p>
              <h2 className="mt-2 text-2xl font-black text-slate-900">Onde vais publicar</h2>
            </div>
            <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-emerald-700">
              <Sparkles className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                Area
              </label>
              <select
                value={selectedAreaId}
                onChange={(event) => {
                  setSelectedAreaId(event.target.value);
                  setSelectedTopicId('');
                  setEditorOpen(false);
                  setSuccessMessage('');
                }}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-400"
              >
                <option value="">Seleciona uma area</option>
                {areas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                Topico
              </label>
              <select
                value={selectedTopicId}
                onChange={(event) => {
                  setSelectedTopicId(event.target.value);
                  setEditorOpen(false);
                  setSuccessMessage('');
                }}
                disabled={!selectedAreaId}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-400 disabled:bg-slate-100 disabled:text-slate-400"
              >
                <option value="">Seleciona um topico</option>
                {topics.map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {topic.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-5 rounded-[1.6rem] border border-slate-200 bg-slate-50 p-4">
            {selectedArea && selectedTopic ? (
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Selecionado</p>
                  <p className="mt-2 text-lg font-black text-slate-900">{selectedTopic.name}</p>
                  <p className="mt-1 text-sm text-slate-500">Area: {selectedArea.name}</p>
                </div>
                <button
                  type="button"
                  onClick={handleOpenEditor}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-white transition hover:bg-emerald-500"
                >
                  <Plus className="h-4 w-4" />
                  Criar questao
                </button>
              </div>
            ) : (
              <p className="text-sm font-medium leading-6 text-slate-500">
                Escolhe primeiro a area e o topico. Assim que definires os dois, o botao de criacao fica pronto.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-slate-950 p-6 text-white shadow-[0_28px_80px_-46px_rgba(15,23,42,0.72)]">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-200">Boas praticas</p>
          <h2 className="mt-2 text-2xl font-black">Checklist rapido</h2>
          <div className="mt-5 space-y-3">
            <div className="rounded-2xl bg-white/5 p-4">
              <p className="text-sm font-black text-white">4 alternativas fixas</p>
              <p className="mt-1 text-xs leading-5 text-slate-300">O formulario ja trabalha no formato A, B, C e D.</p>
            </div>
            <div className="rounded-2xl bg-white/5 p-4">
              <p className="text-sm font-black text-white">1 correta apenas</p>
              <p className="mt-1 text-xs leading-5 text-slate-300">Marca a opcao certa no radio ao lado de cada alternativa.</p>
            </div>
            <div className="rounded-2xl bg-white/5 p-4">
              <p className="text-sm font-black text-white">Explicacao opcional</p>
              <p className="mt-1 text-xs leading-5 text-slate-300">Se adicionares explicacao, ela aparece na correcao do estudante.</p>
            </div>
          </div>
        </div>
      </section>

      {editorOpen && selectedArea && selectedTopic && (
        <section className="rounded-[2rem] border border-emerald-200 bg-white shadow-[0_28px_90px_-52px_rgba(16,185,129,0.2)]">
          <div className="border-b border-slate-100 px-6 py-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">Editor</p>
                <h2 className="mt-2 text-2xl font-black text-slate-900">Nova questao em {selectedTopic.name}</h2>
                <p className="mt-2 text-sm text-slate-500">Area: {selectedArea.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-500 transition hover:bg-slate-50"
              >
                Fechar editor
              </button>
            </div>
          </div>

          <div className="space-y-5 bg-slate-50 px-6 py-6">
            {successMessage && (
              <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm font-semibold text-emerald-800">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  {successMessage}
                </div>
              </div>
            )}

            <div>
              <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                Enunciado
              </label>
              <textarea
                value={draft.content}
                onChange={(event) => setDraft({ ...draft, content: event.target.value })}
                rows={5}
                placeholder="Escreva a questao completa aqui."
                className="w-full rounded-[1.5rem] border border-slate-200 bg-white px-4 py-4 text-sm font-semibold leading-6 text-slate-800 outline-none focus:border-emerald-400"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-[220px_220px_1fr]">
              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                  Dificuldade
                </label>
                <select
                  value={draft.difficulty}
                  onChange={(event) => setDraft({ ...draft, difficulty: event.target.value })}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-400"
                >
                  <option value="easy">Facil</option>
                  <option value="medium">Media</option>
                  <option value="hard">Dificil</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                  Ano do concurso
                </label>
                <input
                  value={draft.examYear}
                  onChange={(event) => setDraft({ ...draft, examYear: event.target.value.replace(/\D+/g, '').slice(0, 4) })}
                  inputMode="numeric"
                  placeholder="Opcional"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                  Explicacao
                </label>
                <textarea
                  value={draft.explanation}
                  onChange={(event) => setDraft({ ...draft, explanation: event.target.value })}
                  rows={4}
                  placeholder="Opcional, mas recomendado."
                  className="w-full rounded-[1.5rem] border border-slate-200 bg-white px-4 py-4 text-sm font-semibold leading-6 text-slate-800 outline-none focus:border-emerald-400"
                />
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                Alternativas
              </p>
              {draft.alternatives.map((alternative, index) => (
                <div key={alternative.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                      Alternativa {getAlternativeBadge(index)}
                    </span>
                    <label className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">
                      <input
                        type="radio"
                        name="question-studio-correct"
                        checked={alternative.is_correct}
                        onChange={() => handleMarkCorrectAlternative(alternative.id)}
                      />
                      Marcar como correta
                    </label>
                  </div>
                  <input
                    value={alternative.content}
                    onChange={(event) => handleAlternativeChange(index, event.target.value)}
                    placeholder={`Texto da alternativa ${getAlternativeBadge(index)}`}
                    className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-400 focus:bg-white"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-100 bg-white px-6 py-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setDraft(createEmptyQuestionDraft());
                  setSuccessMessage('');
                }}
                disabled={saving}
                className="rounded-2xl border border-slate-200 px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
              >
                Limpar
              </button>
              <button
                type="button"
                onClick={handleCreateQuestion}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-white transition hover:bg-emerald-500 disabled:opacity-50"
              >
                {saving ? 'A guardar...' : 'Publicar questao'}
              </button>
            </div>
          </div>
        </section>
      )}

      {selectedTopic && (
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Historico recente</p>
              <h2 className="mt-2 text-2xl font-black text-slate-900">Ultimas questoes deste topico</h2>
            </div>
            {profile?.role === 'admin' && (
              <Link
                to="/admin?tab=content"
                className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 transition hover:text-emerald-600"
              >
                Abrir gestao completa
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>

          {recentQuestions.length === 0 ? (
            <div className="mt-5 rounded-[1.6rem] border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
              <BookOpen className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-500">
                Ainda nao ha questoes recentes neste topico, ou a lista ainda esta a sincronizar.
              </p>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {recentQuestions.map((question, index) => (
                <div key={question.id} className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4">
                  <div className="flex gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-sm font-black text-slate-400 shadow-sm">
                      #{index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold leading-6 text-slate-800">{question.content}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                        <span>{question.difficulty || 'medium'}</span>
                        <span>{new Date(question.created_at).toLocaleDateString('pt-PT')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
