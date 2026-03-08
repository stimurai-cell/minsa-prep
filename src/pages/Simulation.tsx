import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Circle,
  CircleX,
  Clock,
  Sparkles,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { supabase } from '../lib/supabase';
import { playSuccessSound, playErrorSound } from '../lib/sounds';
import {
  calculateSimulationXp,
  getAlternativeLabel,
  pickQuestionsForSession,
  prepareQuestionSet,
} from '../lib/quiz';
import { getDifficultyLabel } from '../lib/labels';
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

type DifficultyPreference = 'mixed' | 'easy' | 'medium' | 'hard';

export default function Simulation() {
  const { profile, refreshProfile } = useAuthStore();
  const { areas, fetchAreas } = useAppStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyPreference>('mixed');
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [pendingAlt, setPendingAlt] = useState<string | null>(null);
  const [selectedAlt, setSelectedAlt] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [timeLeft, setTimeLeft] = useState(1800);
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);
  const [resultHistory, setResultHistory] = useState<boolean[]>([]);
  const [currentAttemptId, setCurrentAttemptId] = useState<string | null>(null);
  const hasPremiumAccess = ['premium', 'elite', 'admin'].includes(profile?.role || '');
  const hasBasicAccess = ['basic', 'premium', 'elite', 'admin'].includes(profile?.role || '');

  const sessionActive = searchParams.get('session') === '1';
  const sessionDifficulty = (searchParams.get('difficulty') as DifficultyPreference) || 'mixed';
  // Non-premium users: allow mixed/easy/medium, but keep hard reserved for premium
  const effectiveDifficulty = hasPremiumAccess ? sessionDifficulty : (sessionDifficulty === 'hard' ? 'medium' : sessionDifficulty);

  useEffect(() => {
    fetchAreas();
  }, [fetchAreas]);

  useEffect(() => {
    setSelectedDifficulty(hasPremiumAccess ? sessionDifficulty : (sessionDifficulty === 'hard' ? 'medium' : sessionDifficulty));
  }, [hasPremiumAccess, sessionDifficulty]);

  useEffect(() => {
    if (!sessionActive || questions.length > 0 || loading || !profile?.selected_area_id) {
      return;
    }

    void bootSimulationSession(effectiveDifficulty);
  }, [effectiveDifficulty, loading, profile?.selected_area_id, questions.length, sessionActive]);

  useEffect(() => {
    if (!sessionActive || !questions.length || !sessionStartedAt) {
      return;
    }

    const timer = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          void finishSimulation();
          return 0;
        }

        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [answers, questions.length, sessionActive, sessionStartedAt]);

  const selectedAreaName = useMemo(
    () => areas.find((area) => area.id === profile?.selected_area_id)?.name || 'Área não definida',
    [areas, profile?.selected_area_id]
  );

  const currentQ = questions[currentQIndex];
  const currentExplanation =
    (Array.isArray(currentQ?.question_explanations) ? currentQ?.question_explanations?.[0]?.content : (currentQ?.question_explanations as any)?.content) ||
    'A resposta correta foi destacada para o seu estudo.';
  const correctAnswers = resultHistory.filter(Boolean).length;
  const wrongAnswers = resultHistory.length - correctAnswers;
  const progressPercent =
    questions.length > 0 ? Math.max(6, ((currentQIndex + (isAnswered ? 1 : 0)) / questions.length) * 100) : 0;

  const resetSimulationSession = (preserveSummary = false) => {
    setQuestions([]);
    setAnswers({});
    setCurrentQIndex(0);
    setPendingAlt(null);
    setSelectedAlt(null);
    setIsAnswered(false);
    setShowIntro(true);
    setTimeLeft(1800);
    setSessionStartedAt(null);
    setResultHistory([]);

    if (!preserveSummary) {
      setSessionSummary(null);
    }
    setCurrentAttemptId(null);
  };

  const awardXp = async (xpEarned: number) => {
    if (!profile?.id) return;

    const updatedXp = (profile.total_xp || 0) + xpEarned;
    await supabase.from('profiles').update({ total_xp: updatedXp }).eq('id', profile.id);
    await refreshProfile(profile.id);
  };

  const bootSimulationSession = async (difficulty: DifficultyPreference) => {
    // Safety check: force medium if non-premium tries to access hard
    const safeDifficulty = !hasPremiumAccess && difficulty === 'hard' ? 'medium' : difficulty;

    if (!profile?.selected_area_id) return;

    setLoading(true);

    try {
      const { data: topics } = await supabase
        .from('topics')
        .select('id')
        .eq('area_id', profile.selected_area_id);

      if (!topics || topics.length === 0) {
        alert('Ainda não existem tópicos cadastrados para a sua área.');
        navigate('/simulation', { replace: true });
        return;
      }

      const topicIds = topics.map((topic) => topic.id);
      let query = supabase
        .from('questions')
        .select(
          `
          id, content, difficulty, topic_id,
          alternatives (id, content, is_correct),
          question_explanations (content)
        `
        )
        .in('topic_id', topicIds)
        .limit(240);

      if (safeDifficulty !== 'mixed') {
        query = query.eq('difficulty', safeDifficulty);
      }

      const { data: qData, error: qError } = await query;

      if (qError) throw qError;

      if (qData && qData.length > 0) {
        resetSimulationSession();
        const selectedQuestions = prepareQuestionSet(pickQuestionsForSession(qData, 30, difficulty));
        setQuestions(selectedQuestions);
        setSessionStartedAt(Date.now());
        setShowIntro(true);

        // Pre-register the attempt for real-time monitoring
        const { data: attempt } = await supabase
          .from('quiz_attempts')
          .insert({
            user_id: profile.id,
            area_id: profile.selected_area_id,
            total_questions: selectedQuestions.length,
            is_completed: false,
            package: profile.role || 'free',
          })
          .select('id')
          .single();

        if (attempt) {
          setCurrentAttemptId(attempt.id);
        }

        // Add to activity_logs for immediate "Action Log" visibility
        try {
          await supabase.from('activity_logs').insert({
            user_id: profile.id,
            activity_type: 'started_simulation',
            activity_metadata: {
              area_name: profile.selected_area_id ? areas.find(a => a.id === profile.selected_area_id)?.name : 'N/A',
              is_live: true
            }
          });
        } catch (logErr) {
          console.error('Error logging simulation start:', logErr);
        }
      } else {
        alert('Não há questões suficientes para esta simulação de prova.');
        navigate('/simulation', { replace: true });
      }
    } catch (error) {
      console.error('Error starting simulation:', error);
      navigate('/simulation', { replace: true });
    } finally {
      setLoading(false);
    }
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
      if (currentAttemptId) {
        // Update the existing pre-registered attempt
        const { error: attemptError } = await supabase
          .from('quiz_attempts')
          .update({
            score: finalScore,
            correct_answers: correctCount,
            is_completed: true,
            completed_at: new Date().toISOString(),
          })
          .eq('id', currentAttemptId);

        if (attemptError) throw attemptError;
      } else {
        // Fallback for cases where pre-registration failed
        const { error: attemptError } = await supabase
          .from('quiz_attempts')
          .insert({
            user_id: profile.id,
            area_id: profile.selected_area_id,
            score: finalScore,
            total_questions: questions.length,
            correct_answers: correctCount,
            is_completed: true,
            completed_at: new Date().toISOString(),
            package: profile.role || 'free',
          })
          .select()
          .single();

        if (attemptError) throw attemptError;
      }

      const answerInserts = questions.map((question) => {
        const selectedAltId = answers[question.id];
        const correctAlt = question.alternatives.find((alternative: any) => alternative.is_correct);
        return {
          quiz_attempt_id: currentAttemptId,
          question_id: question.id,
          selected_alternative_id: selectedAltId || null,
          is_correct: selectedAltId === correctAlt?.id,
        };
      });

      if (currentAttemptId) {
        await supabase.from('quiz_attempt_answers').insert(answerInserts);
      }
      await awardXp(xpEarned);

      // Registrar atividade detalhada de conclusão
      try {
        await supabase.from('activity_logs').insert({
          user_id: profile.id,
          activity_type: 'simulation_attempt',
          activity_metadata: {
            score: finalScore,
            correct: correctCount,
            total: questions.length,
            duration: durationSeconds
          }
        });
      } catch (logErr) {
        console.error('Erro ao registar log de conclusão:', logErr);
      }
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
  };

  const startSimulation = () => {
    const difficulty = hasPremiumAccess ? selectedDifficulty : (selectedDifficulty === 'hard' ? 'medium' : selectedDifficulty);

    // Verificar limite de simulacoes para utilizadores free: 1 por semana
    if (!hasBasicAccess && profile?.id) {
      void (async () => {
        try {
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
          const { data: recent, error } = await supabase
            .from('quiz_attempts')
            .select('id')
            .eq('user_id', profile.id)
            .gte('completed_at', sevenDaysAgo)
            .eq('is_completed', true);

          if (error) throw error;
          if (recent && recent.length >= 1) {
            alert('No gratuito, você pode fazer 1 simulação de prova por semana. Faça upgrade para um plano pago para fazer mais.');
            return;
          }

          navigate(`/simulation?session=1&difficulty=${difficulty}`);
        } catch (err) {
          console.error('Erro ao verificar limite de simulacoes:', err);
          navigate(`/simulation?session=1&difficulty=${difficulty}`);
        }
      })();
      return;
    }

    navigate(`/simulation?session=1&difficulty=${difficulty}`);
  };

  const leaveSimulationSession = () => {
    if (window.confirm('Deseja sair desta prova agora? O progresso desta sessão será perdido.')) {
      resetSimulationSession();
      navigate('/simulation', { replace: true });
    }
  };

  const confirmAnswer = () => {
    if (!pendingAlt || isAnswered || !currentQ) return;

    const selectedAlternative = currentQ.alternatives.find((alt: any) => alt.id === pendingAlt);
    const isCorrect = Boolean(selectedAlternative?.is_correct);

    if (isCorrect) {
      playSuccessSound();
    } else {
      playErrorSound();
    }

    setAnswers((prev) => ({ ...prev, [currentQ.id]: pendingAlt }));
    setSelectedAlt(pendingAlt);
    setIsAnswered(true);
    setResultHistory((prev) => [...prev, isCorrect]);
  };

  const nextQuestion = async () => {
    if (currentQIndex < questions.length - 1) {
      setCurrentQIndex((prev) => prev + 1);
      setPendingAlt(null);
      setSelectedAlt(null);
      setIsAnswered(false);
      return;
    }

    await finishSimulation();
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
        primaryActionLabel="Voltar a prova"
        onPrimaryAction={() => {
          resetSimulationSession();
          setSessionSummary(null);
          navigate('/simulation', { replace: true });
        }}
        secondaryActionLabel="Nova simulacao de prova"
        onSecondaryAction={() => {
          resetSimulationSession();
          setSessionSummary(null);
          navigate('/simulation', { replace: true });
        }}
      />
    );
  }

  if (sessionActive) {
    if (loading || !currentQ) {
      return (
        <div className="flex min-h-[100dvh] items-center justify-center bg-[#f6f7f2] px-6">
          <div className="w-full max-w-sm rounded-[2rem] border border-white/80 bg-white px-6 py-10 text-center shadow-[0_26px_70px_-42px_rgba(15,23,42,0.35)]">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-cyan-100 border-t-cyan-500" />
            <p className="mt-5 text-lg font-black text-slate-900">A preparar a prova</p>
            <p className="mt-2 text-sm text-slate-500">Estamos a montar uma sequencia equilibrada de questoes para a sua area.</p>
          </div>
        </div>
      );
    }

    if (showIntro) {
      return (
        <div className="min-h-[100dvh] bg-[#f6f7f2] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
          <div className="mx-auto flex min-h-[calc(100dvh-2.5rem)] max-w-xl flex-col">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={leaveSimulationSession}
                className="inline-flex h-12 w-12 items-center justify-center rounded-2xl text-slate-400 transition hover:bg-white"
                aria-label="Fechar prova"
              >
                <X className="h-8 w-8" />
              </button>
              <div className="h-4 flex-1 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full w-[7%] rounded-full bg-[linear-gradient(90deg,#39d4f1_0%,#31dfb0_100%)]" />
              </div>
            </div>

            <div className="flex flex-1 flex-col justify-center gap-8 pb-6 pt-10">
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="rounded-[2.2rem] bg-[linear-gradient(135deg,#04131d_0%,#063446_100%)] p-6 text-white shadow-[0_28px_90px_-50px_rgba(8,145,178,0.7)]"
              >
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">
                  <Sparkles className="h-4 w-4" />
                  Modo prova
                </div>
                <h1 className="mt-5 text-3xl font-black leading-tight">Entre em ambiente de simulacao real.</h1>
                <p className="mt-3 text-base leading-7 text-cyan-50">
                  Voce vai responder {questions.length} questoes em modo {getDifficultyLabel(selectedDifficulty).toLowerCase()}, uma por vez, com temporizador visivel e correcao imediata antes de seguir.
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-white/10 px-4 py-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-200">Area</p>
                    <p className="mt-2 text-lg font-black">{selectedAreaName}</p>
                  </div>
                  <div className="rounded-2xl bg-white/10 px-4 py-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-200">Tempo</p>
                    <p className="mt-2 text-lg font-black">30 min</p>
                  </div>
                  <div className="rounded-2xl bg-white/10 px-4 py-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-200">Objetivo</p>
                    <p className="mt-2 text-lg font-black">Maximo foco</p>
                  </div>
                </div>
              </motion.div>

              <motion.button
                type="button"
                onClick={() => setShowIntro(false)}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.16 }}
                className="mt-auto rounded-[1.8rem] bg-[linear-gradient(90deg,#39d4f1_0%,#31dfb0_100%)] px-6 py-4 text-xl font-black uppercase tracking-[0.18em] text-slate-950 shadow-[0_8px_0_0_rgba(8,145,178,0.9)] transition hover:translate-y-[1px] hover:shadow-[0_6px_0_0_rgba(8,145,178,0.9)]"
              >
                Comecar prova
              </motion.button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-[100dvh] bg-[#f6f7f2] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] text-slate-900">
        <div className="mx-auto flex min-h-[calc(100dvh-2rem)] max-w-2xl flex-col">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={leaveSimulationSession}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl text-slate-400 transition hover:bg-white"
              aria-label="Sair da prova"
            >
              <X className="h-7 w-7" />
            </button>
            <div className="h-4 flex-1 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#39d4f1_0%,#31dfb0_100%)] transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.25)]">
              <Clock className="h-4 w-4 text-cyan-500" />
              {formatTime(timeLeft)}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-white px-4 py-3 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.25)]">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Questao</p>
              <p className="mt-1 text-base font-black text-slate-900">{currentQIndex + 1}/{questions.length}</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-600">Certas</p>
              <p className="mt-1 text-base font-black text-emerald-700">{correctAnswers}</p>
            </div>
            <div className="rounded-2xl bg-rose-50 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-rose-500">Erradas</p>
              <p className="mt-1 text-base font-black text-rose-600">{wrongAnswers}</p>
            </div>
          </div>

          <div className="mt-3 flex min-h-0 flex-1 overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentQ.id}
                initial={{ opacity: 0, x: 28 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -28 }}
                transition={{ duration: 0.24, ease: 'easeOut' }}
                className="flex h-full min-h-0 flex-col rounded-[2rem] bg-white px-4 py-4 shadow-[0_28px_90px_-50px_rgba(15,23,42,0.3)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Prova completa
                  </span>
                  <span className="rounded-full bg-cyan-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-600">
                    {selectedAreaName}
                  </span>
                </div>

                <h1 className="mt-3 text-lg font-black leading-7 text-slate-900 md:text-[1.45rem] md:leading-9">
                  {currentQ.content}
                </h1>

                <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
                  <div className="grid gap-2.5">
                    {currentQ.alternatives.map((alt: any, index: number) => {
                      const isSelected = pendingAlt === alt.id || selectedAlt === alt.id;
                      const isCorrect = Boolean(alt.is_correct);
                      const isWrongSelection = isAnswered && selectedAlt === alt.id && !isCorrect;

                      let classes =
                        'flex w-full items-start gap-3 rounded-[1.35rem] border-2 px-3 py-3 text-left transition-all ';

                      if (!isAnswered) {
                        classes += isSelected
                          ? 'border-cyan-400 bg-cyan-50'
                          : 'border-slate-200 bg-white hover:border-cyan-200 hover:bg-cyan-50/50';
                      } else if (isCorrect) {
                        classes += 'border-emerald-400 bg-emerald-50';
                      } else if (isWrongSelection) {
                        classes += 'border-rose-300 bg-rose-50';
                      } else {
                        classes += 'border-slate-200 bg-slate-50 opacity-75';
                      }

                      return (
                        <button
                          key={alt.id}
                          type="button"
                          onClick={() => !isAnswered && setPendingAlt(alt.id)}
                          disabled={isAnswered}
                          className={classes}
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-sm font-black uppercase text-slate-600">
                            {getAlternativeLabel(index)}
                          </div>
                          <div className="flex min-w-0 flex-1 items-start gap-3">
                            <div className="pt-0.5">
                              {!isAnswered &&
                                (isSelected ? (
                                  <CheckCircle2 className="h-5 w-5 text-cyan-500" />
                                ) : (
                                  <Circle className="h-5 w-5 text-slate-300" />
                                ))}
                              {isAnswered && isCorrect && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
                              {isAnswered && isWrongSelection && <CircleX className="h-5 w-5 text-rose-500" />}
                              {isAnswered && !isCorrect && !isWrongSelection && <Circle className="h-5 w-5 text-slate-300" />}
                            </div>
                            <span className="text-sm leading-5 text-slate-800">{alt.content}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <motion.div
            key={`${currentQ.id}-${isAnswered ? 'answered' : 'pending'}`}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className={`mt-3 rounded-[1.6rem] border px-4 py-4 shadow-[0_24px_60px_-44px_rgba(15,23,42,0.35)] ${isAnswered ? 'border-lime-200 bg-lime-100' : 'border-white/80 bg-white'
              }`}
          >
            {!isAnswered ? (
              <>
                <p className="text-sm text-slate-600">Confirme a sua resposta para registar o resultado desta questao.</p>
                <button
                  type="button"
                  onClick={confirmAnswer}
                  disabled={!pendingAlt}
                  className="mt-3 w-full rounded-[1.15rem] bg-[linear-gradient(90deg,#39d4f1_0%,#31dfb0_100%)] px-5 py-3.5 text-base font-black uppercase tracking-[0.12em] text-slate-950 shadow-[0_6px_0_0_rgba(8,145,178,0.85)] transition hover:translate-y-[1px] hover:shadow-[0_4px_0_0_rgba(8,145,178,0.85)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Confirmar resposta
                </button>
              </>
            ) : (
              <>
                <p className={`text-xl font-black ${selectedAlt && currentQ.alternatives.find((alt: any) => alt.id === selectedAlt)?.is_correct ? 'text-lime-700' : 'text-rose-600'}`}>
                  {selectedAlt && currentQ.alternatives.find((alt: any) => alt.id === selectedAlt)?.is_correct
                    ? 'Resposta certa!'
                    : 'Resposta corrigida'}
                </p>
                <p className="mt-2 max-h-24 overflow-y-auto pr-1 text-sm leading-5 text-slate-700">{currentExplanation}</p>
                <button
                  type="button"
                  onClick={nextQuestion}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-[1.15rem] bg-[#67d300] px-5 py-3.5 text-base font-black uppercase tracking-[0.12em] text-white shadow-[0_6px_0_0_rgba(77,124,15,0.95)] transition hover:translate-y-[1px] hover:shadow-[0_4px_0_0_rgba(77,124,15,0.95)]"
                >
                  {currentQIndex < questions.length - 1 ? 'Proxima questao' : 'Finalizar prova'}
                  <ArrowRight className="h-5 w-5" />
                </button>
              </>
            )}
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 md:space-y-8">
      <section className="rounded-[2rem] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f2fbff_40%,#f5fff3_100%)] p-5 shadow-[0_24px_80px_-44px_rgba(15,23,42,0.35)] md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">
              <Sparkles className="h-4 w-4" />
              Simulacao de prova
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">Simulação de prova</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">Modo focado: temporizador, progresso e contadores visíveis.</p>
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

      <section className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_24px_80px_-44px_rgba(15,23,42,0.35)] md:p-6">
          <h2 className="text-2xl font-black text-slate-900">Pronto para a simulação?</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Prova de 30 questões no modo focado.</p>

          <button
            type="button"
            onClick={startSimulation}
            className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-emerald-600 px-6 py-4 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            Iniciar simulacao de prova
          </button>

          <div className="mt-4">
            <label className="mb-2 block text-sm font-semibold text-slate-700">Nivel</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(['mixed', 'easy', 'medium', 'hard'] as DifficultyPreference[]).map((difficulty) => (
                <button
                  key={difficulty}
                  type="button"
                  onClick={() => {
                    if (!hasPremiumAccess && difficulty === 'hard') {
                      navigate(`/premium?plan=focus#payment-section`);
                      return;
                    }
                    setSelectedDifficulty(difficulty);
                  }}
                  disabled={!hasPremiumAccess && difficulty === 'hard'}
                  className={`relative rounded-2xl px-3 py-3 text-sm font-semibold transition ${selectedDifficulty === difficulty
                    ? 'bg-emerald-600 text-white'
                    : !hasPremiumAccess && difficulty === 'hard'
                      ? 'cursor-pointer border border-slate-200 bg-slate-100 text-slate-400'
                      : 'border border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                >
                  <span className="inline-flex items-center gap-2">
                    {getDifficultyLabel(difficulty)}
                    {!hasPremiumAccess && difficulty === 'hard' && (
                      <span className="ml-2 inline-flex items-center rounded-full bg-amber-200/40 px-2 py-0.5 text-xs font-semibold text-amber-900">
                        Premium
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
            {hasPremiumAccess ? (
              <p className="mt-2 text-xs text-slate-500">
                Em modo misto, a prova tenta distribuir questões entre fácil, médio e difícil antes de completar as 30.
              </p>
            ) : (
              <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
                No plano gratuito você pode usar <span className="font-black">Fácil</span>, <span className="font-black">Médio</span> e <span className="font-black">Misto</span>.
                O modo <span className="font-black">Difícil</span> está reservado ao Premium.
                <Link to="/premium" className="ml-1 font-black underline">
                  Ver premium
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* resumo removido para simplificar a página de prova */}
      </section>
    </div>
  );
}
