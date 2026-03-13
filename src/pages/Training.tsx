import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Circle,
  CircleX,
  Sparkles,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { supabase } from '../lib/supabase';
import { playSuccessSound, playErrorSound } from '../lib/sounds';
import { getDifficultyLabel } from '../lib/labels';
import { WifiOff, Download, CreditCard, RefreshCw } from 'lucide-react';
import { useOfflineStore } from '../store/useOfflineStore';
import {
  calculateTrainingXp,
  getAlternativeLabel,
  pickQuestionsForSession,
  prepareQuestionSet,
} from '../lib/quiz';
import { useAuthStore } from '../store/useAuthStore';
import { useAppStore } from '../store/useAppStore';
import AreaLockCard from '../components/AreaLockCard';
import SessionCelebration from '../components/SessionCelebration';
import { awardXp as unifiedAwardXp } from '../lib/xp';
import { savePendingXp, savePendingLog } from '../lib/offlineStore';
import { calculateNextReview } from '../lib/srs';
import { checkForBadges, type Badge } from '../lib/badges';
import BadgeNotification from '../components/BadgeNotification';

type SessionSummary = {
  correctAnswers: number;
  totalQuestions: number;
  xpEarned: number;
  durationSeconds: number;
};

type DifficultyPreference = 'mixed' | 'easy' | 'medium' | 'hard';

export default function Training() {
  const { profile, refreshProfile } = useAuthStore();
  const { areas, topics, fetchAreas, fetchTopics } = useAppStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [selectedTopic, setSelectedTopic] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyPreference>('mixed');
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [pendingAlt, setPendingAlt] = useState<string | null>(null);
  const [selectedAlt, setSelectedAlt] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);
  const [resultHistory, setResultHistory] = useState<boolean[]>([]);
  const [earnedBadges, setEarnedBadges] = useState<Badge[]>([]);
  const [showBadge, setShowBadge] = useState<Badge | null>(null);
  const { downloadedQuestions, isOfflineMode, setOfflineMode, addQuestions } = useOfflineStore();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const hasPremiumAccess = ['premium', 'elite', 'admin'].includes(profile?.role || '');
  const hasBasicAccess = ['basic', 'premium', 'elite', 'admin'].includes(profile?.role || '');
  const hasOfflinePackage = profile?.active_packages?.includes('pacote_offline');

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const sessionActive = searchParams.get('session') === '1';
  const sessionTopicId = searchParams.get('topic') || '';
  const isReviewMode = searchParams.get('type') === 'review';
  const sessionDifficulty = (searchParams.get('difficulty') as DifficultyPreference) || 'mixed';
  // Allow all difficulties for non-premium except 'hard' (difícil) which remains premium-only
  const effectiveDifficulty = hasPremiumAccess ? sessionDifficulty : (sessionDifficulty === 'hard' ? 'medium' : sessionDifficulty);

  useEffect(() => {
    fetchAreas();
  }, [fetchAreas]);

  useEffect(() => {
    if (profile?.selected_area_id) {
      fetchTopics(profile.selected_area_id);
    }
  }, [profile?.selected_area_id, fetchTopics]);

  useEffect(() => {
    if (sessionTopicId) {
      setSelectedTopic(sessionTopicId);
    }
  }, [sessionTopicId]);

  // Se não houver tópico selecionado explicitamente, pré-seleciona um tópico ALEATÓRIO
  useEffect(() => {
    if (!selectedTopic && topics && topics.length > 0) {
      const randomIndex = Math.floor(Math.random() * topics.length);
      setSelectedTopic(topics[randomIndex].id);
    }
  }, [topics, selectedTopic]);

  useEffect(() => {
    setSelectedDifficulty(hasPremiumAccess ? sessionDifficulty : (sessionDifficulty === 'hard' ? 'medium' : sessionDifficulty));
  }, [hasPremiumAccess, sessionDifficulty]);

  useEffect(() => {
    if (!sessionActive || questions.length > 0 || loading) {
      return;
    }

    if (isReviewMode) {
      void bootReviewSession();
    } else if (sessionTopicId) {
      void bootTrainingSession(sessionTopicId, effectiveDifficulty);
    }
  }, [effectiveDifficulty, isReviewMode, loading, questions.length, sessionActive, sessionTopicId]);

  const selectedAreaName = useMemo(
    () => areas.find((area) => area.id === profile?.selected_area_id)?.name || 'Área não definida',
    [areas, profile?.selected_area_id]
  );

  const selectedTopicName =
    topics.find((topic) => topic.id === selectedTopic)?.name || 'Tópico não definido';

  const currentQ = questions[currentQIndex];
  const currentExplanation =
    (Array.isArray(currentQ?.question_explanations) ? currentQ?.question_explanations?.[0]?.content : (currentQ?.question_explanations as any)?.content) ||
    'A resposta correta foi destacada para o seu estudo.';
  const correctAnswers = resultHistory.filter(Boolean).length;
  const wrongAnswers = resultHistory.length - correctAnswers;
  const progressPercent =
    questions.length > 0 ? Math.max(8, ((currentQIndex + (isAnswered ? 1 : 0)) / questions.length) * 100) : 0;

  const resetTrainingSession = (preserveSummary = false) => {
    setQuestions([]);
    setCurrentQIndex(0);
    setPendingAlt(null);
    setSelectedAlt(null);
    setIsAnswered(false);
    setShowIntro(true);
    setSessionStartedAt(null);
    setResultHistory([]);

    if (!preserveSummary) {
      setSessionSummary(null);
    }
  };

  const awardXp = async (xpEarned: number) => {
    if (!profile?.id) return;

    if (navigator.onLine) {
      const result = await unifiedAwardXp(profile.id, xpEarned, profile.total_xp || 0);
      if (result.success) {
        await refreshProfile(profile.id);
      }
    } else {
      await savePendingXp(xpEarned);
    }
  };

  const bootReviewSession = async () => {
    if (!profile?.id) return;
    setLoading(true);

    try {
      const { data: srsQuestions, error: srsError } = await supabase
        .from('user_question_srs')
        .select(`
          question_id,
          questions (
            id, content, difficulty,
            alternatives (id, content, is_correct),
            question_explanations (content)
          )
        `)
        .eq('user_id', profile.id)
        .lte('next_review', new Date().toISOString())
        .limit(20);

      if (srsError) throw srsError;

      if (srsQuestions && srsQuestions.length > 0) {
        const formattedQuestions = srsQuestions.map((srs: any) => srs.questions).filter(Boolean);
        resetTrainingSession();
        setQuestions(prepareQuestionSet(formattedQuestions));
        setSessionStartedAt(Date.now());
        setShowIntro(true);
      } else {
        alert('Não há questões para revisar hoje! Bom trabalho.');
        navigate('/dashboard', { replace: true });
      }
    } catch (error) {
      console.error('Error starting review session:', error);
      navigate('/dashboard', { replace: true });
    } finally {
      setLoading(false);
    }
  };

  const bootTrainingSession = async (topicId: string, difficulty: DifficultyPreference) => {
    // Modo Offline Prioritário
    if (isOfflineMode && downloadedQuestions.length > 0) {
      const topicQuestions = downloadedQuestions.filter(q => topicId === 'random' || q.topic_id === topicId);
      if (topicQuestions.length > 0) {
        resetTrainingSession();
        setQuestions(prepareQuestionSet(pickQuestionsForSession(topicQuestions, 10, difficulty)));
        setSessionStartedAt(Date.now());
        setShowIntro(true);
        return;
      } else {
        alert('Sem questões offline para este tópico. Por favor, conecte-se para baixar mais.');
        setOfflineMode(false);
      }
    }

    const safeDifficulty = !hasPremiumAccess && difficulty === 'hard' ? 'medium' : difficulty;
    setLoading(true);

    try {
      // 1. Fetch ALL IDs for the topic/difficulty to ensure total randomness
      let idsQuery = supabase
        .from('questions')
        .select('id')
        .eq('topic_id', topicId);

      if (safeDifficulty !== 'mixed') {
        idsQuery = idsQuery.eq('difficulty', safeDifficulty);
      }

      const { data: idData, error: idError } = await idsQuery;
      if (idError) throw idError;

      if (!idData || idData.length === 0) {
        alert('Nenhuma questão encontrada para este tópico.');
        navigate('/training', { replace: true });
        return;
      }

      // 2. Shuffle and pick IDs
      const shuffledIds = idData.map(q => q.id).sort(() => Math.random() - 0.5).slice(0, 20);

      // 3. Fetch full data for these IDs
      const { data: qData, error: qError } = await supabase
        .from('questions')
        .select(`
          id, content, difficulty,
          alternatives (id, content, is_correct),
          question_explanations (content)
        `)
        .in('id', shuffledIds);

      if (qError) throw qError;

      if (qData && qData.length > 0) {
        resetTrainingSession();
        // Maintain the shuffled order
        const orderedQuestions = shuffledIds.map(id => qData.find(q => q.id === id)).filter(Boolean);
        setQuestions(prepareQuestionSet(orderedQuestions));
        setSessionStartedAt(Date.now());
        setShowIntro(true);

        try {
          await supabase.from('activity_logs').insert({
            user_id: profile.id,
            activity_type: 'started_training',
            activity_date: new Date().toISOString(),
            activity_metadata: {
              topic_name: topics.find(t => t.id === topicId)?.name || 'N/A'
            }
          });
        } catch (logErr) {
          console.error('Erro ao registar início de treino:', logErr);
        }
      } else {
        alert('Erro ao carregar questões.');
        navigate('/training', { replace: true });
      }
    } catch (error) {
      console.error('Error starting training:', error);
      navigate('/training', { replace: true });
    } finally {
      setLoading(false);
    }
  };

  const downloadQuestionsForOffline = async () => {
    if (!profile?.id || !isOnline) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('questions')
        .select(`
          id, topic_id, content, difficulty,
          alternatives (id, content, is_correct),
          question_explanations (content)
        `)
        .limit(100); // Baixa as 100 mais relevantes/recentes para o cache

      if (error) throw error;
      if (data) {
        const formatted = data.map(q => ({
          ...q,
          explanation: (Array.isArray(q.question_explanations) ? q.question_explanations?.[0]?.content : (q.question_explanations as any)?.content)
        }));
        addQuestions(formatted as any);
        alert('Download concluído! Você já pode treinar offline.');
      }
    } catch (err) {
      console.error('Erro ao baixar questões:', err);
      alert('Erro ao baixar questões para uso offline.');
    } finally {
      setLoading(false);
    }
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

    // Check for badges
    if (profile?.id) {
      const badges = await checkForBadges(profile.id);
      if (badges.length > 0) {
        setEarnedBadges(badges);
        setShowBadge(badges[0]);
      }
    }

    // Registrar conclusão de treino
    try {
      const logData = {
        user_id: profile.id,
        activity_type: 'completed_training',
        activity_date: new Date().toISOString(),
        activity_metadata: {
          topic_name: selectedTopicName,
          correct: correctAnswers,
          total: totalQuestions,
          xp: xpEarned
        }
      };

      if (navigator.onLine) {
        await supabase.from('activity_logs').insert(logData);
      } else {
        await savePendingLog(logData);
      }
    } catch (logErr) {
      console.error('Erro ao registar fim de treino:', logErr);
    }
  };

  const startTraining = () => {
    if (!selectedTopic) return;

    // Non-premium users can use mixed, easy or medium, but not hard.
    const difficulty = hasPremiumAccess ? selectedDifficulty : (selectedDifficulty === 'hard' ? 'medium' : selectedDifficulty);

    let actualTopic = selectedTopic;
    if (actualTopic === 'random') {
      const topicIds = topics.map(t => t.id);
      actualTopic = topicIds[Math.floor(Math.random() * topicIds.length)];
    }

    // Limite para utilizadores free: 30 questões por dia (Ignorado em Modo Offline com Pacote)
    if (!hasBasicAccess && profile?.id && !isOfflineMode) {
      const today = new Date().toISOString().slice(0, 10);
      void (async () => {
        try {
          const { count, error } = await supabase
            .from('activity_logs')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', profile.id)
            .eq('activity_type', 'training_question')
            .gte('created_at', today);

          if (error) throw error;
          const answeredToday = count || 0;
          if (answeredToday >= 30) {
            alert('Limite diário de perguntas (30) atingido. Faça upgrade para um plano pago para treinar sem limites.');
            return;
          }

          navigate(`/training?session=1&topic=${actualTopic}&difficulty=${difficulty}`);
        } catch (err) {
          console.error('Erro ao verificar limite diário:', err);
          navigate(`/training?session=1&topic=${actualTopic}&difficulty=${difficulty}`);
        }
      })();
      return;
    }

    navigate(`/training?session=1&topic=${actualTopic}&difficulty=${difficulty}`);
  };

  const leaveTrainingSession = () => {
    if (window.confirm('Deseja sair deste treino agora? O progresso desta sessão será perdido.')) {
      resetTrainingSession();
      navigate('/training', { replace: true });
    }
  };

  const confirmAnswer = async () => {
    if (!pendingAlt || isAnswered) return;

    const selectedAlternative = currentQ?.alternatives?.find((alt: any) => alt.id === pendingAlt);
    const isCorrect = Boolean(selectedAlternative?.is_correct);

    if (isCorrect) {
      playSuccessSound();
    } else {
      playErrorSound();
    }

    setSelectedAlt(pendingAlt);
    setIsAnswered(true);
    setResultHistory((prev) => [...prev, isCorrect]);

    if (profile?.id && selectedTopic && !isOfflineMode) {
      try {
        const { data: progress } = await supabase
          .from('user_topic_progress')
          .select('*')
          .eq('user_id', profile.id)
          .eq('topic_id', selectedTopic)
          .single();

        // Spaced Repetition (SRS) Update
        const { data: srsData } = await supabase
          .from('user_question_srs')
          .select('*')
          .eq('user_id', profile.id)
          .eq('question_id', currentQ.id)
          .single();

        const quality = isCorrect ? 5 : 0;
        const nextSrs = calculateNextReview(quality, srsData || undefined);

        await supabase.from('user_question_srs').upsert({
          user_id: profile.id,
          question_id: currentQ.id,
          ...nextSrs,
          last_reviewed_at: new Date().toISOString(),
        }, { onConflict: 'user_id,question_id' });

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
      <>
        <SessionCelebration
          title="Treino concluído!"
          subtitle={`Você terminou ${selectedTopicName} com ${sessionSummary.correctAnswers} acertos. O seu XP já entrou no perfil.`}
          xpEarned={sessionSummary.xpEarned}
          accuracy={accuracy}
          durationSeconds={sessionSummary.durationSeconds}
          primaryActionLabel="Voltar ao treino"
          onPrimaryAction={() => {
            resetTrainingSession();
            setSessionSummary(null);
            navigate('/training', { replace: true });
          }}
          secondaryActionLabel="Treinar outro tópico"
          onSecondaryAction={() => {
            resetTrainingSession();
            setSelectedTopic('');
            setSessionSummary(null);
            navigate('/training', { replace: true });
          }}
        />
        {showBadge && (
          <BadgeNotification
            badge={showBadge}
            onClose={() => {
              const remaining = earnedBadges.slice(1);
              setEarnedBadges(remaining);
              setShowBadge(remaining.length > 0 ? remaining[0] : null);
            }}
          />
        )}
      </>
    );
  }

  if (sessionActive) {
    if (loading || !currentQ) {
      return (
        <div className="flex min-h-[100dvh] items-center justify-center bg-[#f6f7f2] px-6">
          <div className="w-full max-w-sm rounded-[2rem] border border-white/80 bg-white px-6 py-10 text-center shadow-[0_26px_70px_-42px_rgba(15,23,42,0.35)]">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-500" />
            <p className="mt-5 text-lg font-black text-slate-900">A montar o seu treino</p>
            <p className="mt-2 text-sm text-slate-500">As questões estão a ser organizadas para caberem num fluxo rápido.</p>
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
                onClick={leaveTrainingSession}
                className="inline-flex h-12 w-12 items-center justify-center rounded-2xl text-slate-400 transition hover:bg-white"
                aria-label="Fechar treino"
              >
                <X className="h-8 w-8" />
              </button>
              <div className="h-4 flex-1 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full w-[10%] rounded-full bg-[linear-gradient(90deg,#39d4f1_0%,#31dfb0_100%)]" />
              </div>
            </div>

            <div className="flex flex-1 flex-col justify-center gap-8 pb-6 pt-10">
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="grid gap-6 md:grid-cols-[180px_1fr] md:items-end"
              >
                <motion.div
                  initial={{ scale: 0.92, rotate: -4 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ duration: 0.4, delay: 0.05, ease: 'easeOut' }}
                  className="mx-auto flex h-44 w-44 items-center justify-center rounded-[2.5rem] bg-[radial-gradient(circle_at_top,#91f7ff,transparent_42%),linear-gradient(180deg,#0f172a_0%,#111827_100%)] text-white shadow-[0_30px_80px_-44px_rgba(15,23,42,0.7)]"
                >
                  <BookOpen className="h-20 w-20 text-cyan-300" />
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.35, delay: 0.1, ease: 'easeOut' }}
                  className="rounded-[2rem] border-4 border-slate-200 bg-white px-6 py-5 shadow-[0_20px_50px_-36px_rgba(15,23,42,0.35)]"
                >
                  <p className="text-3xl font-black leading-tight text-slate-800">
                    {isReviewMode ? 'Hora de consolidar.' : 'Vamos entrar em ritmo.'}
                  </p>
                  <p className="mt-3 text-lg leading-8 text-slate-600">
                    {isReviewMode
                      ? `Você vai revisar ${questions.length} questões que precisam da sua atenção hoje.`
                      : `Você vai responder ${questions.length} questões de ${selectedTopicName} em modo ${getDifficultyLabel(selectedDifficulty).toLowerCase()}.`
                    }
                  </p>
                  <p className="mt-2 text-base text-slate-500">
                    Toque, confirme e receba a correção na mesma tela antes de seguir.
                  </p>
                </motion.div>
              </motion.div>

              <motion.button
                type="button"
                onClick={() => setShowIntro(false)}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.18 }}
                className="mt-auto rounded-[1.8rem] bg-[linear-gradient(90deg,#39d4f1_0%,#31dfb0_100%)] px-6 py-4 text-xl font-black uppercase tracking-[0.18em] text-slate-950 shadow-[0_8px_0_0_rgba(8,145,178,0.9)] transition hover:translate-y-[1px] hover:shadow-[0_6px_0_0_rgba(8,145,178,0.9)]"
              >
                Continuar
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
              onClick={leaveTrainingSession}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl text-slate-400 transition hover:bg-white"
              aria-label="Sair do treino"
            >
              <X className="h-7 w-7" />
            </button>
            <div className="h-4 flex-1 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#39d4f1_0%,#31dfb0_100%)] transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
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
                    <Sparkles className="h-3.5 w-3.5" />
                    {isReviewMode ? 'Revisão Inteligente' : selectedTopicName}
                  </span>
                  <span className="rounded-full bg-cyan-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-600">
                    {getDifficultyLabel(currentQ.difficulty)}
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
                <p className="text-sm text-slate-600">Escolha uma alinea e confirme para ver a correcao.</p>
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
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className={`text-xl font-black ${selectedAlt && currentQ.alternatives.find((alt: any) => alt.id === selectedAlt)?.is_correct ? 'text-lime-700' : 'text-rose-600'}`}>
                      {selectedAlt && currentQ.alternatives.find((alt: any) => alt.id === selectedAlt)?.is_correct
                        ? 'Excelente!'
                        : 'Vamos corrigir'}
                    </p>
                    <p className="mt-2 max-h-24 overflow-y-auto pr-1 text-sm leading-5 text-slate-700">{currentExplanation}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={nextQuestion}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-[1.15rem] bg-[#67d300] px-5 py-3.5 text-base font-black uppercase tracking-[0.12em] text-white shadow-[0_6px_0_0_rgba(77,124,15,0.95)] transition hover:translate-y-[1px] hover:shadow-[0_4px_0_0_rgba(77,124,15,0.95)]"
                >
                  {currentQIndex < questions.length - 1 ? 'Seguir' : 'Ver resultado'}
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
      <section className="rounded-[2rem] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#fdfde9_38%,#eef9f3_100%)] p-5 shadow-[0_28px_90px_-50px_rgba(15,23,42,0.35)] md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
              <Sparkles className="h-4 w-4" />
              Modo treino
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">Pratique, ganhe XP e avance</h1>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[1.6rem] border border-yellow-200 bg-yellow-50 px-5 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-yellow-600">XP total</p>
              <p className="mt-2 text-3xl font-black text-yellow-600">{profile.total_xp || 0}</p>
            </div>
            <div className="rounded-[1.6rem] border border-emerald-200 bg-emerald-50 px-5 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Área</p>
              <p className="mt-2 text-xl font-black text-slate-900">{selectedAreaName}</p>
            </div>
          </div>
        </div>

        {hasOfflinePackage && isOnline && (
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={downloadQuestionsForOffline}
              disabled={loading}
              className="flex items-center gap-2 rounded-2xl bg-white border-2 border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:border-emerald-500 hover:text-emerald-500 transition-all"
            >
              <Download className="h-4 w-4" />
              {loading ? 'Baixando...' : 'Atualizar questões offline'}
            </button>
            <button
              onClick={() => setOfflineMode(!isOfflineMode)}
              className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold transition-all ${isOfflineMode
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                : 'bg-white border-2 border-slate-200 text-slate-600'
                }`}
            >
              <WifiOff className="h-4 w-4" />
              Modo Offline: {isOfflineMode ? 'Ativo' : 'Inativo'}
            </button>
          </div>
        )}
      </section>

      {!isOnline && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-[2rem] border-2 border-orange-500/20 bg-orange-500/10 p-6 shadow-xl backdrop-blur-md"
        >
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-lg shadow-orange-500/20">
              <WifiOff className="h-8 w-8" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-xl font-black text-orange-200">Você está offline</h3>
              <p className="mt-1 text-slate-300">
                {hasOfflinePackage
                  ? "Seu pacote offline está ativo! Você pode continuar treinando com as questões baixadas."
                  : "Não fique parado! Com o Pacote Offline (900kz), você treina mesmo sem internet ou saldo."}
              </p>
            </div>
            {!hasOfflinePackage ? (
              <Link
                to="/premium?package=pacote_offline"
                className="flex items-center gap-2 rounded-2xl bg-white px-6 py-4 text-sm font-black uppercase tracking-tight text-slate-900 transition-all hover:scale-105"
              >
                <CreditCard className="h-4 w-4" />
                Ativar por 900 Kz
              </Link>
            ) : (
              <button
                onClick={() => setOfflineMode(true)}
                className="flex items-center gap-2 rounded-2xl bg-emerald-500 px-6 py-4 text-sm font-black uppercase tracking-tight text-white transition-all hover:scale-105 shadow-lg shadow-emerald-500/20"
              >
                <Download className="h-4 w-4" />
                Treinar Offline
              </button>
            )}
          </div>
        </motion.div>
      )}

      <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.35)] md:p-6">
          <h2 className="text-2xl font-black text-slate-900">Escolha um tópico</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            A sessão abre numa tela dedicada ao exercício para manter foco total.
          </p>

          <div className="mt-6 space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-sm font-semibold text-slate-500">Area</p>
              <p className="mt-1 text-lg font-black text-slate-900">{selectedAreaName}</p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Tópico</label>
              <select
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-800 outline-none transition focus:border-emerald-500"
              >
                <option value="" disabled>
                  Selecione um tópico
                </option>
                <option value="random">🌟 Tópico Surpresa (Misto)</option>
                {topics.map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {topic.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Nível</label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(['mixed', 'easy', 'medium', 'hard'] as DifficultyPreference[]).map((difficulty) => (
                  <button
                    key={difficulty}
                    type="button"
                    onClick={() => {
                      // allow mixed, easy and medium for all users; hard remains premium-only
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
                  Em modo misto, o sistema tenta equilibrar Fácil, Normal e Difícil antes de completar a sessão.
                </p>
              ) : (
                <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
                  No plano gratuito você pode usar <span className="font-black">Fácil</span>, <span className="font-black">Médio</span> e <span className="font-black">Misto</span>.
                  O modo <span className="font-black">Difícil</span> continua reservado ao Premium.
                  <Link to="/premium" className="ml-1 font-black underline">
                    Ver premium
                  </Link>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={startTraining}
              disabled={!selectedTopic}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Iniciar treino
            </button>
          </div>
        </div>

        {/* painel secundário removido para deixar a página menos carregada (fluxo focado, correção imediata e progresso removidos) */}
      </section>
    </div>
  );
}
