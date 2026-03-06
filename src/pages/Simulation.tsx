import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Clock, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { calculateSimulationXp, prepareQuestionSet } from '../lib/quiz';
import { useAuthStore } from '../store/useAuthStore';
import { useAppStore } from '../store/useAppStore';
import AreaLockCard from '../components/AreaLockCard';
import SessionCelebration from '../components/SessionCelebration';

type SessionSummary = {
  correctAnswers: number;
  totalQuestions: number;
  xpEarned: number;
  durationSeconds: number;
  score: number;
};

export default function Simulation() {
  const { profile, refreshProfile } = useAuthStore();
  const { areas, fetchAreas } = useAppStore();

  const [loading, setLoading] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(3600);
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);

  useEffect(() => {
    fetchAreas();
  }, [fetchAreas]);

  useEffect(() => {
    let timer: any;
    if (sessionStarted && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && sessionStarted) {
      finishSimulation();
    }
    return () => clearInterval(timer);
  }, [sessionStarted, timeLeft]);

  const selectedAreaName = useMemo(
    () => areas.find((area) => area.id === profile?.selected_area_id)?.name || 'Area nao definida',
    [areas, profile?.selected_area_id]
  );

  const awardXp = async (xpEarned: number) => {
    if (!profile?.id) return;

    const updatedXp = (profile.total_xp || 0) + xpEarned;
    await supabase.from('profiles').update({ total_xp: updatedXp }).eq('id', profile.id);
    await refreshProfile(profile.id);
  };

  const finishSimulation = async () => {
    if (!profile?.id || !profile.selected_area_id || questions.length === 0) return;

    let correctCount = 0;
    questions.forEach((question) => {
      const selectedAltId = answers[question.id];
      const correctAlt = question.alternatives.find((alternative: any) => alternative.is_correct);
      if (selectedAltId === correctAlt?.id) {
        correctCount++;
      }
    });

    const finalScore = Math.round((correctCount / questions.length) * 100);
    const durationSeconds = Math.max(
      1,
      Math.round((Date.now() - (sessionStartedAt || Date.now())) / 1000)
    );
    const xpEarned = calculateSimulationXp(correctCount, questions.length, durationSeconds);

    try {
      const { data: attempt, error: attemptError } = await supabase
        .from('quiz_attempts')
        .insert({
          user_id: profile.id,
          area_id: profile.selected_area_id,
          score: finalScore,
          total_questions: questions.length,
          correct_answers: correctCount,
          is_completed: true,
          completed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (attemptError) throw attemptError;

      const answerInserts = questions.map((question) => {
        const selectedAltId = answers[question.id];
        const correctAlt = question.alternatives.find((alternative: any) => alternative.is_correct);
        return {
          quiz_attempt_id: attempt.id,
          question_id: question.id,
          selected_alternative_id: selectedAltId || null,
          is_correct: selectedAltId === correctAlt?.id,
        };
      });

      await supabase.from('quiz_attempt_answers').insert(answerInserts);
      await awardXp(xpEarned);
    } catch (err) {
      console.error('Error saving simulation results:', err);
    }

    setSessionSummary({
      correctAnswers: correctCount,
      totalQuestions: questions.length,
      xpEarned,
      durationSeconds,
      score: finalScore,
    });
    setSessionStarted(false);
  };

  const startSimulation = async () => {
    if (!profile?.selected_area_id) return;

    setLoading(true);
    try {
      const { data: topics } = await supabase
        .from('topics')
        .select('id')
        .eq('area_id', profile.selected_area_id);

      if (topics && topics.length > 0) {
        const topicIds = topics.map((topic) => topic.id);
        const { data: qData, error: qError } = await supabase
          .from('questions')
          .select(
            `
            id, content, difficulty, topic_id,
            alternatives (id, content, is_correct)
          `
          )
          .in('topic_id', topicIds)
          .limit(30);

        if (qError) throw qError;

        if (qData && qData.length > 0) {
          setQuestions(prepareQuestionSet(qData));
          setSessionStarted(true);
          setAnswers({});
          setTimeLeft(3600);
          setSessionStartedAt(Date.now());
          setSessionSummary(null);
        } else {
          alert('Nao ha questoes suficientes para esta simulacao de prova.');
        }
      } else {
        alert('Ainda nao existem topicos cadastrados para a sua area.');
      }
    } catch (error) {
      console.error('Error starting simulation:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAnswer = (questionId: string, alternativeId: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: alternativeId }));
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!profile?.selected_area_id) {
    return <AreaLockCard areas={areas} />;
  }

  if (sessionSummary) {
    return (
      <SessionCelebration
        title="Simulacao concluida!"
        subtitle={`Voce fechou a prova com ${sessionSummary.score}% de aproveitamento e somou novo XP ao seu percurso.`}
        xpEarned={sessionSummary.xpEarned}
        accuracy={sessionSummary.score}
        durationSeconds={sessionSummary.durationSeconds}
        primaryActionLabel="Receber XP"
        onPrimaryAction={() => setSessionSummary(null)}
        secondaryActionLabel="Nova simulacao de prova"
        onSecondaryAction={() => {
          setQuestions([]);
          setSessionSummary(null);
        }}
      />
    );
  }

  if (!sessionStarted) {
    return (
      <div className="mx-auto max-w-5xl space-y-8">
        <section className="rounded-[2rem] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f2fbff_40%,#f5fff3_100%)] p-6 shadow-[0_24px_80px_-44px_rgba(15,23,42,0.35)] md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">
                <Sparkles className="h-4 w-4" />
                Simulacao de prova
              </div>
              <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-900">Prova completa com recompensa final</h1>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Entre, resolva a prova, veja o resultado final e recolha XP no fim da sessao.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.6rem] border border-sky-200 bg-sky-50 px-5 py-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-600">Area</p>
                <p className="mt-2 text-xl font-black text-slate-900">{selectedAreaName}</p>
              </div>
              <div className="rounded-[1.6rem] border border-yellow-200 bg-yellow-50 px-5 py-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-yellow-600">XP total</p>
                <p className="mt-2 text-3xl font-black text-yellow-600">{profile.total_xp || 0}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_24px_80px_-44px_rgba(15,23,42,0.35)]">
            <h2 className="text-2xl font-black text-slate-900">Pronto para a simulacao de prova?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              O sistema monta 30 questoes da sua area e embaralha a ordem para deixar a experiencia sempre fresca.
            </p>

            <button
              onClick={startSimulation}
              disabled={loading}
              className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-emerald-600 px-6 py-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'A preparar prova...' : 'Iniciar simulacao de prova'}
            </button>
          </div>

          <div className="rounded-[1.75rem] border border-blue-100 bg-blue-50 p-5 text-blue-900 shadow-[0_18px_50px_-40px_rgba(59,130,246,0.45)]">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-1 h-5 w-5" />
              <div>
                <h3 className="font-bold">Como funciona</h3>
                <ul className="mt-3 space-y-2 text-sm leading-6">
                  <li>30 questoes de multipla escolha.</li>
                  <li>Tempo limite de 60 minutos.</li>
                  <li>Resultado final com XP, precisao e tempo.</li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="sticky top-0 z-10 flex items-center justify-between rounded-[1.75rem] border border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
        <div>
          <h1 className="text-xl font-black text-slate-900">Simulacao de prova</h1>
          <p className="text-sm text-slate-500">{selectedAreaName}</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 font-bold text-slate-700">
          <Clock className="h-5 w-5" />
          {formatTime(timeLeft)}
        </div>
      </div>

      <div className="space-y-8 pb-24">
        {questions.map((question, index) => (
          <div key={question.id} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_24px_70px_-44px_rgba(15,23,42,0.35)]">
            <h3 className="mb-6 flex gap-4 text-lg font-semibold text-slate-900">
              <span className="font-black text-emerald-600">{index + 1}.</span>
              {question.content}
            </h3>
            <div className="space-y-3 pl-0 md:pl-8">
              {question.alternatives.map((alternative: any, altIndex: number) => (
                <label
                  key={alternative.id}
                  className={`flex items-start gap-3 rounded-[1.4rem] border-2 p-4 transition-all ${
                    answers[question.id] === alternative.id
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'cursor-pointer border-slate-200 hover:border-emerald-200'
                  }`}
                >
                  <input
                    type="radio"
                    name={`question-${question.id}`}
                    value={alternative.id}
                    checked={answers[question.id] === alternative.id}
                    onChange={() => handleSelectAnswer(question.id, alternative.id)}
                    className="mt-1 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-black text-slate-600">
                    {['a', 'b', 'c', 'd'][altIndex]}
                  </span>
                  <span className="text-slate-800">{alternative.content}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200 bg-white/95 p-4 backdrop-blur md:pl-64">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <p className="text-sm font-semibold text-slate-500">
            Respondidas: {Object.keys(answers).length} de {questions.length}
          </p>
          <button
            onClick={() => {
              if (confirm('Tem certeza que deseja finalizar a simulacao de prova?')) {
                finishSimulation();
              }
            }}
            className="rounded-xl bg-emerald-600 px-8 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
          >
            Finalizar simulacao de prova
          </button>
        </div>
      </div>
    </div>
  );
}
