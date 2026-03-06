import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookOpen, CheckCircle, Circle, Sparkles, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getDifficultyLabel } from '../lib/labels';
import {
  calculateTrainingXp,
  getAlternativeLabel,
  prepareQuestionSet,
} from '../lib/quiz';
import { useAuthStore } from '../store/useAuthStore';
import { useAppStore } from '../store/useAppStore';
import AreaLockCard from '../components/AreaLockCard';
import SessionCelebration from '../components/SessionCelebration';

type SessionSummary = {
  correctAnswers: number;
  totalQuestions: number;
  xpEarned: number;
  durationSeconds: number;
};

export default function Training() {
  const { profile, refreshProfile } = useAuthStore();
  const { areas, topics, fetchAreas, fetchTopics } = useAppStore();

  const [selectedTopic, setSelectedTopic] = useState('');
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [pendingAlt, setPendingAlt] = useState<string | null>(null);
  const [selectedAlt, setSelectedAlt] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);

  useEffect(() => {
    fetchAreas();
  }, [fetchAreas]);

  useEffect(() => {
    if (profile?.selected_area_id) {
      fetchTopics(profile.selected_area_id);
    }
  }, [profile?.selected_area_id, fetchTopics]);

  const selectedAreaName = useMemo(
    () => areas.find((area) => area.id === profile?.selected_area_id)?.name || 'Area nao definida',
    [areas, profile?.selected_area_id]
  );

  const selectedTopicName =
    topics.find((topic) => topic.id === selectedTopic)?.name || 'Topico nao definido';

  const awardXp = async (xpEarned: number) => {
    if (!profile?.id) return;

    const updatedXp = (profile.total_xp || 0) + xpEarned;
    await supabase.from('profiles').update({ total_xp: updatedXp }).eq('id', profile.id);
    await refreshProfile(profile.id);
  };

  const finishTraining = async () => {
    const totalQuestions = questions.length;
    const durationSeconds = Math.max(
      1,
      Math.round((Date.now() - (sessionStartedAt || Date.now())) / 1000)
    );
    const xpEarned = calculateTrainingXp(correctAnswers, totalQuestions, durationSeconds);

    await awardXp(xpEarned);

    setSessionSummary({
      correctAnswers,
      totalQuestions,
      xpEarned,
      durationSeconds,
    });
    setSessionStarted(false);
  };

  const startTraining = async () => {
    if (!selectedTopic) return;

    setLoading(true);
    try {
      const { data: qData, error: qError } = await supabase
        .from('questions')
        .select(
          `
          id, content, difficulty,
          alternatives (id, content, is_correct),
          question_explanations (content)
        `
        )
        .eq('topic_id', selectedTopic)
        .limit(10);

      if (qError) throw qError;

      if (qData && qData.length > 0) {
        setQuestions(prepareQuestionSet(qData));
        setSessionStarted(true);
        setCurrentQIndex(0);
        setIsAnswered(false);
        setSelectedAlt(null);
        setPendingAlt(null);
        setCorrectAnswers(0);
        setSessionSummary(null);
        setSessionStartedAt(Date.now());
      } else {
        alert('Nenhuma questao encontrada para este topico.');
      }
    } catch (error) {
      console.error('Error starting training:', error);
    } finally {
      setLoading(false);
    }
  };

  const confirmAnswer = async () => {
    if (!pendingAlt || isAnswered) return;

    const currentQuestion = questions[currentQIndex];
    const selectedAlternative = currentQuestion?.alternatives?.find((alt: any) => alt.id === pendingAlt);
    const isCorrect = Boolean(selectedAlternative?.is_correct);

    setSelectedAlt(pendingAlt);
    setIsAnswered(true);

    if (isCorrect) {
      setCorrectAnswers((prev) => prev + 1);
    }

    if (profile?.id && selectedTopic) {
      try {
        const { data: progress } = await supabase
          .from('user_topic_progress')
          .select('*')
          .eq('user_id', profile.id)
          .eq('topic_id', selectedTopic)
          .single();

        let newScore = progress ? Number(progress.domain_score) : 0;
        newScore = isCorrect ? Math.min(100, newScore + 2) : Math.max(0, newScore - 1);

        if (progress) {
          await supabase
            .from('user_topic_progress')
            .update({
              domain_score: newScore,
              questions_answered: progress.questions_answered + 1,
              correct_answers: progress.correct_answers + (isCorrect ? 1 : 0),
              last_reviewed_at: new Date().toISOString(),
            })
            .eq('id', progress.id);
        } else {
          await supabase.from('user_topic_progress').insert({
            user_id: profile.id,
            topic_id: selectedTopic,
            domain_score: newScore,
            questions_answered: 1,
            correct_answers: isCorrect ? 1 : 0,
          });
        }
      } catch (err) {
        console.error('Error updating progress:', err);
      }
    }
  };

  const nextQuestion = async () => {
    if (currentQIndex < questions.length - 1) {
      setCurrentQIndex((prev) => prev + 1);
      setIsAnswered(false);
      setSelectedAlt(null);
      setPendingAlt(null);
      return;
    }

    await finishTraining();
  };

  if (!profile?.selected_area_id) {
    return <AreaLockCard areas={areas} />;
  }

  if (sessionSummary) {
    const accuracy =
      sessionSummary.totalQuestions > 0
        ? (sessionSummary.correctAnswers / sessionSummary.totalQuestions) * 100
        : 0;

    return (
      <SessionCelebration
        title="Treino concluido!"
        subtitle={`Voce terminou ${selectedTopicName} com ${sessionSummary.correctAnswers} acertos. O seu XP ja entrou no perfil.`}
        xpEarned={sessionSummary.xpEarned}
        accuracy={accuracy}
        durationSeconds={sessionSummary.durationSeconds}
        primaryActionLabel="Receber XP"
        onPrimaryAction={() => setSessionSummary(null)}
        secondaryActionLabel="Treinar outro topico"
        onSecondaryAction={() => {
          setSelectedTopic('');
          setSessionSummary(null);
        }}
      />
    );
  }

  if (!sessionStarted) {
    return (
      <div className="mx-auto max-w-5xl space-y-5 md:space-y-8">
        <section className="rounded-[2rem] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#fdfde9_38%,#eef9f3_100%)] p-5 shadow-[0_28px_90px_-50px_rgba(15,23,42,0.35)] md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
                <Sparkles className="h-4 w-4" />
                Modo treino
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">Pratique, ganhe XP e avance</h1>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Escolha um topico, responda 10 questoes e feche a sessao com bonus de experiencia.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.6rem] border border-yellow-200 bg-yellow-50 px-5 py-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-yellow-600">XP total</p>
                <p className="mt-2 text-3xl font-black text-yellow-600">{profile.total_xp || 0}</p>
              </div>
              <div className="rounded-[1.6rem] border border-emerald-200 bg-emerald-50 px-5 py-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Area</p>
                <p className="mt-2 text-xl font-black text-slate-900">{selectedAreaName}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.35)] md:p-6">
            <h2 className="text-2xl font-black text-slate-900">Escolha um topico</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              O treino monta uma sessao curta e dinamica para manter o ritmo.
            </p>

            <div className="mt-6 space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-sm font-semibold text-slate-500">Area</p>
                <p className="mt-1 text-lg font-black text-slate-900">{selectedAreaName}</p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Topico</label>
                <select
                  value={selectedTopic}
                  onChange={(e) => setSelectedTopic(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-800 outline-none transition focus:border-emerald-500"
                >
                  <option value="" disabled>
                    Selecione um topico
                  </option>
                  {topics.map((topic) => (
                    <option key={topic.id} value={topic.id}>
                      {topic.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={startTraining}
                disabled={!selectedTopic || loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? 'A preparar questoes...' : 'Iniciar treino'}
              </button>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-[1.7rem] border border-lime-200 bg-lime-50 p-5">
              <p className="text-sm font-bold text-lime-700">Sessao curta</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">10 questoes por vez para manter foco e ritmo.</p>
            </div>
            <div className="rounded-[1.7rem] border border-sky-200 bg-sky-50 p-5">
              <p className="text-sm font-bold text-sky-700">XP a cada sessao</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">Acertos, ritmo e conclusao entram na experiencia final.</p>
            </div>
            <div className="rounded-[1.7rem] border border-amber-200 bg-amber-50 p-5">
              <p className="text-sm font-bold text-amber-700">Questoes dinamicas</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">A ordem das questoes e das alternativas muda a cada nova sessao.</p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const currentQ = questions[currentQIndex];
  const currentExplanation =
    currentQ.question_explanations?.[0]?.content || 'Nenhuma explicacao disponivel para esta questao.';

  return (
    <div className="mx-auto max-w-6xl">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_320px] xl:gap-6">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-[0_24px_80px_-42px_rgba(15,23,42,0.45)] md:p-5">
          <div className="mb-4 flex flex-col gap-4 rounded-[1.5rem] bg-[linear-gradient(135deg,#0f172a_0%,#17352a_100%)] px-4 py-4 text-white md:px-5 md:py-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-200">Sessao ativa</p>
              <h1 className="mt-2 flex items-center gap-2 text-xl font-black md:text-2xl">
                <BookOpen className="h-6 w-6 text-emerald-300" />
                Questao {currentQIndex + 1} de {questions.length}
              </h1>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <span className="rounded-full bg-white/10 px-4 py-2 text-center text-sm font-semibold">
                {selectedAreaName}
              </span>
              <span className="rounded-full bg-white/10 px-4 py-2 text-center text-sm font-semibold">
                Dificuldade: {getDifficultyLabel(currentQ.difficulty)}
              </span>
            </div>
          </div>

          <div className="flex min-h-[calc(100vh-15rem)] flex-col">
            <div className="rounded-[1.75rem] border border-slate-100 bg-slate-50 px-4 py-4 md:px-5 md:py-5">
              <p className="text-base font-semibold leading-7 text-slate-900 md:text-lg md:leading-8">{currentQ.content}</p>
            </div>

            <div className="mt-4 flex-1 overflow-hidden">
              <div className="grid h-full gap-3 overflow-y-auto pr-1">
                {currentQ.alternatives.map((alt: any, index: number) => {
                  const isSelected = pendingAlt === alt.id || selectedAlt === alt.id;
                  const isCorrect = Boolean(alt.is_correct);
                  const isWrongSelection = isAnswered && selectedAlt === alt.id && !isCorrect;

                  let classes =
                    'flex w-full items-start gap-4 rounded-[1.4rem] border px-4 py-4 text-left transition ';

                  if (!isAnswered) {
                    classes += isSelected
                      ? 'border-emerald-500 bg-emerald-50 shadow-[0_18px_42px_-28px_rgba(16,185,129,0.5)]'
                      : 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/60';
                  } else if (isCorrect) {
                    classes += 'border-emerald-500 bg-emerald-50';
                  } else if (isWrongSelection) {
                    classes += 'border-red-400 bg-red-50';
                  } else {
                    classes += 'border-slate-200 bg-slate-50 opacity-70';
                  }

                  return (
                    <button
                      key={alt.id}
                      onClick={() => !isAnswered && setPendingAlt(alt.id)}
                      disabled={isAnswered}
                    className={classes}
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-sm font-black text-slate-600">
                      {getAlternativeLabel(index)}
                      </div>
                      <div className="flex flex-1 items-start gap-3">
                        <div className="pt-0.5">
                          {!isAnswered &&
                            (isSelected ? (
                              <CheckCircle className="h-5 w-5 text-emerald-600" />
                            ) : (
                              <Circle className="h-5 w-5 text-slate-300" />
                            ))}
                          {isAnswered && isCorrect && <CheckCircle className="h-5 w-5 text-emerald-600" />}
                          {isAnswered && isWrongSelection && <XCircle className="h-5 w-5 text-red-500" />}
                          {isAnswered && !isCorrect && !isWrongSelection && <Circle className="h-5 w-5 text-slate-300" />}
                        </div>
                        <span className="text-sm leading-6 text-slate-800">{alt.content}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 rounded-[1.75rem] border border-slate-200 bg-white px-4 py-4 shadow-[0_18px_50px_-42px_rgba(15,23,42,0.35)] md:px-5">
              {!isAnswered ? (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-slate-600">Escolha uma alternativa e confirme para seguir.</p>
                  <button
                    onClick={confirmAnswer}
                    disabled={!pendingAlt}
                    className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Confirmar resposta
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">Explicacao</p>
                    <p className="mt-2 max-h-28 overflow-y-auto pr-1 text-sm leading-6 text-slate-700">
                      {currentExplanation}
                    </p>
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={nextQuestion}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 md:w-auto"
                    >
                      {currentQIndex < questions.length - 1 ? 'Proxima questao' : 'Ver resultado'}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <aside className="order-first grid gap-4 sm:grid-cols-2 lg:order-none lg:block lg:space-y-4">
          <div className="rounded-[2rem] border border-yellow-200 bg-yellow-50 p-5 shadow-[0_24px_60px_-42px_rgba(234,179,8,0.35)]">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-yellow-600">XP atual</p>
            <p className="mt-2 text-4xl font-black text-yellow-600">{profile.total_xp || 0}</p>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_-44px_rgba(15,23,42,0.35)]">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Resumo da sessao</p>
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-sm text-slate-500">Topico</p>
                <p className="text-base font-bold text-slate-900">{selectedTopicName}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Acertos</p>
                <p className="text-3xl font-black text-slate-900">{correctAnswers}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Questoes restantes</p>
                <p className="text-3xl font-black text-slate-900">{questions.length - currentQIndex - 1}</p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
