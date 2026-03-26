import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Award,
  BarChart2,
  BookOpen,
  Calendar,
  CheckCircle,
  Circle,
  Clock3,
  Crown,
  Flame,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Target,
  UserPlus,
  Zap,
  ArrowRight,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { createStudyPlanForUser } from '../lib/studyPlan';
import { useAuthStore } from '../store/useAuthStore';
import { useAppStore } from '../store/useAppStore';
import AreaLockCard from '../components/AreaLockCard';
import DailyTasks from '../components/DailyTasks';
import AIMentor from '../components/AIMentor';
import NotificationCenter from '../components/NotificationCenter';
import { APP_ICON_SRC } from '../lib/brand';
import { usePermissions } from '../lib/permissions';
import { EliteStrategyManager } from '../lib/eliteStrategy';
import { fetchStreakSnapshot } from '../lib/streak';

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const { areas, fetchAreas } = useAppStore();
  const perms = usePermissions();
  const isEliteUser = profile?.role === 'elite';
  const isPaidUser = perms.canAccessSimulation;
  const isFreeUser = profile?.role === 'free';
  const trainingUsesAutomaticTopic = perms.hasGuidedTraining;
  const reviewPath = '/training?session=1&type=review';
  const [stats, setStats] = useState({
    totalQuestions: 0,
    avgScore: 0,
    lastSimScore: 0,
    dueQuestions: 0,
  });
  const [topicProgress, setTopicProgress] = useState<any[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [missingGoal, setMissingGoal] = useState('');
  const [savingGoal, setSavingGoal] = useState(false);
  const [freezingStreak, setFreezingStreak] = useState(false);
  const [lastTaskCount, setLastTaskCount] = useState<number | null>(null);
  const [streakWeek, setStreakWeek] = useState<{ label: string; completed: boolean; date: string }[]>([]);
  const [streakLoading, setStreakLoading] = useState(false);
  const [displayStreakCount, setDisplayStreakCount] = useState(profile?.streak_count || 0);
  const [currentStrategy, setCurrentStrategy] = useState<any>(null);
  const [eliteGateResolved, setEliteGateResolved] = useState(false);
  const trainingPath = trainingUsesAutomaticTopic ? '/training' : '/training?mode=manual';
  const shouldStartWithReview = isPaidUser && stats.dueQuestions > 0;
  const trainingEyebrow = shouldStartWithReview
    ? 'Revisao do dia'
    : perms.hasGuidedTraining
      ? 'Plano do dia'
      : 'Treino';
  const trainingTitle = shouldStartWithReview
    ? 'Abrir revisao guiada'
    : perms.hasGuidedTraining
      ? 'Abrir treino guiado'
      : 'Escolher treino';
  const trainingDescription = shouldStartWithReview
    ? `Voce tem ${stats.dueQuestions} revisoes prontas agora. Vamos abrir isso primeiro para a contagem descer corretamente.`
    : perms.hasGuidedTraining
      ? 'Seu treino ja chega pronto para continuar.'
      : 'Escolha o tema e comece a praticar.';

  useEffect(() => {
    setDisplayStreakCount(profile?.streak_count || 0);
  }, [profile?.streak_count]);

  useEffect(() => {
    if (areas.length === 0) {
      void fetchAreas();
    }
  }, [areas.length, fetchAreas]);

  useEffect(() => {
    let active = true;

    const prepareDashboardFlow = async () => {
      if (!profile?.id) {
        if (active) {
          setCurrentStrategy(null);
          setEliteGateResolved(false);
        }
        return;
      }

      if (!isEliteUser) {
        if (active) {
          setCurrentStrategy(null);
          setEliteGateResolved(true);
        }
        return;
      }

      setEliteGateResolved(false);

      try {
        const [{ data: onboarding }, strategy] = await Promise.all([
          supabase
            .from('elite_onboarding')
            .select('completed')
            .eq('user_id', profile.id)
            .maybeSingle(),
          EliteStrategyManager.getCurrentWeekStrategy(profile.id),
        ]);

        if (!active) return;

        if (!onboarding?.completed) {
          navigate('/elite-welcome', { replace: true });
          return;
        }

        let resolvedStrategy = strategy;
        if (!resolvedStrategy) {
          const { data: legacyPlan } = await supabase
            .from('study_plans')
            .select('plan_json')
            .eq('user_id', profile.id)
            .order('generated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!active) return;
          resolvedStrategy = legacyPlan?.plan_json || null;
        }

        setCurrentStrategy(resolvedStrategy || null);
        setEliteGateResolved(true);

        const needsReassessment = await EliteStrategyManager.checkWeekCompletion(profile.id);
        if (!active || !needsReassessment) return;

        await EliteStrategyManager.completeWeekAndReassess(profile.id);
        if (!active) return;

        const refreshedStrategy = await EliteStrategyManager.getCurrentWeekStrategy(profile.id);
        if (!active) return;

        if (refreshedStrategy) {
          setCurrentStrategy(refreshedStrategy);
        }
      } catch (error) {
        console.error('Error checking elite onboarding:', error);
        if (active) {
          setEliteGateResolved(true);
        }
      }
    };

    void prepareDashboardFlow();

    return () => {
      active = false;
    };
  }, [isEliteUser, navigate, profile?.id]);

  const canLoadDashboardData = Boolean(profile?.id) && (!isEliteUser || eliteGateResolved);

  useEffect(() => {
    const fetchStats = async () => {
      if (!profile?.id || !profile.selected_area_id || !canLoadDashboardData) {
        return;
      }

      setStatsLoading(true);

      try {
        const [progressResult, simResult, dueResult] = await Promise.all([
          supabase
            .from('user_topic_progress')
            .select('questions_answered, correct_answers, domain_score, topics!inner(name, area_id)')
            .eq('user_id', profile.id)
            .eq('topics.area_id', profile.selected_area_id),
          supabase
            .from('quiz_attempts')
            .select('score')
            .eq('user_id', profile.id)
            .eq('is_completed', true)
            .order('completed_at', { ascending: false })
            .limit(1),
          supabase
            .from('user_question_srs')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', profile.id)
            .lte('next_review', new Date().toISOString()),
        ]);

        let totalQ = 0;
        let totalC = 0;
        const progressData = progressResult.data || [];

        if (progressData.length > 0) {
          totalQ = progressData.reduce((acc, p) => acc + (p.questions_answered || 0), 0);
          totalC = progressData.reduce((acc, p) => acc + (p.correct_answers || 0), 0);
          setTopicProgress(progressData);
        } else {
          setTopicProgress([]);
        }

        const avg = totalQ > 0 ? Math.round((totalC / totalQ) * 100) : 0;
        const simData = simResult.data || [];

        const lastSim = simData && simData.length > 0 ? simData[0].score : 0;
        const dueCount = dueResult.count || 0;

        setStats({
          totalQuestions: totalQ,
          avgScore: avg,
          lastSimScore: lastSim,
          dueQuestions: dueCount,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
        setTopicProgress([]);
        setStats({
          totalQuestions: 0,
          avgScore: 0,
          lastSimScore: 0,
          dueQuestions: 0,
        });
      } finally {
        setStatsLoading(false);
      }
    };

    void fetchStats();
  }, [canLoadDashboardData, profile?.id, profile?.selected_area_id]);

  useEffect(() => {
    if (profile?.id && profile?.selected_area_id && profile?.role !== 'elite' && canLoadDashboardData) {
      void (async () => {
        try {
          const { data: existing } = await supabase.from('study_plans').select('id').eq('user_id', profile.id).maybeSingle();
          if (!existing) {
            await createStudyPlanForUser(profile as any);
          }
        } catch (err) {
          console.error('Erro ver/plano de estudo:', err);
        }
      })();
    }
  }, [canLoadDashboardData, profile, profile?.id, profile?.role, profile?.selected_area_id]);

  useEffect(() => {
    if (!profile?.id || !canLoadDashboardData) return;

    const fetchStreakWeek = async () => {
      setStreakLoading(true);
      try {
        const snapshot = await fetchStreakSnapshot(profile.id);
        setStreakWeek(snapshot.week);
        setDisplayStreakCount(Math.max(profile?.streak_count || 0, snapshot.currentStreak));
      } catch (err) {
        console.error('Erro ao buscar ofensiva semanal:', err);
        setStreakLoading(false);
      } finally {
        setStreakLoading(false);
      }
    };

    void fetchStreakWeek();
  }, [canLoadDashboardData, profile?.id, profile?.streak_count]);

  useEffect(() => {
    if (!profile?.id || !canLoadDashboardData) return;

    const monitorTasks = async () => {
      const { getDailyTasksProgress } = await import('../lib/dailyTasks');
      const tasks = await getDailyTasksProgress(profile.id);
      const completedNow = tasks.filter((task) => task.completed).length;

      if (lastTaskCount !== null && completedNow > lastTaskCount) {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Tarefa Concluida!', {
            body: 'Voce deu mais um passo importante na sua preparacao.',
            icon: APP_ICON_SRC,
          });
        }
      }
      setLastTaskCount(completedNow);
    };

    void monitorTasks();
    const interval = setInterval(monitorTasks, 30000);
    return () => clearInterval(interval);
  }, [canLoadDashboardData, profile?.id, lastTaskCount]);

  const areaName = useMemo(
    () => areas.find((area) => area.id === profile?.selected_area_id)?.name || 'Area ainda nao definida',
    [areas, profile?.selected_area_id]
  );

  if (!profile?.selected_area_id) {
    return (
      <AreaLockCard
        areas={areas}
        title="Conclua o seu perfil de estudante"
        description="Escolha a area principal para desbloquear o painel, o treino e a simulacao de prova."
      />
    );
  }

  const handleSaveMissingGoal = async () => {
    if (!profile?.id || !missingGoal) return;
    setSavingGoal(true);
    try {
      await supabase.from('profiles').update({ goal: missingGoal }).eq('id', profile.id);
      window.location.reload();
    } catch (err) {
      console.error(err);
      setSavingGoal(false);
    }
  };

  const handleBuyStreakFreeze = async () => {
    if (!profile?.id || (profile?.total_xp || 0) < 1000) return;
    setFreezingStreak(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          streak_freeze_active: true,
          total_xp: (profile.total_xp || 0) - 1000,
          last_streak_freeze_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      if (error) throw error;
      alert('Protecao de ofensiva ativada! Sua sequencia esta protegida por 24h.');
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert('Erro ao ativar protecao.');
    } finally {
      setFreezingStreak(false);
    }
  };

  const nextActionPath = shouldStartWithReview ? reviewPath : isFreeUser ? '/practice' : trainingPath;
  const nextActionTitle = isFreeUser ? 'Escolha como quer estudar hoje' : trainingTitle;
  const nextActionDescription = isFreeUser
    ? 'Abra os modos de estudo e escolha a sessao certa para hoje.'
    : trainingDescription;
  const nextActionLabel = isFreeUser
    ? 'Abrir modos de estudo'
    : shouldStartWithReview
      ? 'Continuar revisao'
      : 'Continuar estudo';

  const quickLinks = [
    {
      to: '/practice',
      title: 'Modos de estudo',
      description: 'Treino, velocidade, batalha e simulacao num unico lugar.',
      icon: BookOpen,
      tone: 'emerald',
    },
    {
      to: '/ranking',
      title: 'Ranking da area',
      description: 'Consulte sua posicao local sem tirar Ligas do menu principal.',
      icon: BarChart2,
      tone: 'sky',
    },
    {
      to: '/social',
      title: 'Comunidade',
      description: 'Amigos, atividade recente e convites num fluxo separado do estudo.',
      icon: UserPlus,
      tone: 'rose',
    },
    isFreeUser
      ? {
          to: '/premium',
          title: 'Desbloquear Premium',
          description: 'Acesse recursos avancados sem poluir o painel principal.',
          icon: Crown,
          tone: 'amber',
        }
      : {
          to: '/news',
          title: 'Avisos e conquistas',
          description: 'Veja novidades do app e destaques da comunidade.',
          icon: Sparkles,
          tone: 'indigo',
        },
  ];

  const quickLinkToneStyles = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    sky: 'border-sky-200 bg-sky-50 text-sky-700',
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    indigo: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  } as const;

  return (
    <div className="space-y-5 md:space-y-8">
      {(profile as any)?.goal === null && (
        <div className="bg-orange-50 border-2 border-orange-200 rounded-[2rem] p-6 shadow-sm flex flex-col items-center text-center animate-in zoom-in duration-300">
          <Target className="w-12 h-12 text-orange-500 mb-4" />
          <h2 className="text-2xl font-black text-slate-800 mb-2">Qual e o seu foco principal?</h2>
          <p className="text-slate-600 mb-6">Defina o que deseja alcancar com os seus estudos para acompanharmos a sua evolucao.</p>

          <select
            value={missingGoal}
            onChange={(e) => setMissingGoal(e.target.value)}
            className="w-full max-w-sm rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-400 mb-4"
          >
            <option value="" disabled>Selecione o seu objetivo principal</option>
            <option value="Aprender e rever conceitos">Aprender e rever conceitos</option>
            <option value="Passar no concurso publico">Passar no concurso publico</option>
            <option value="Descontrair e treinar">Descontrair e treinar</option>
            <option value="Testar minhas habilidades">Testar as minhas habilidades</option>
          </select>

          <button
            onClick={handleSaveMissingGoal}
            disabled={!missingGoal || savingGoal}
            className="w-full max-w-sm bg-orange-500 hover:bg-orange-600 text-white font-bold py-3.5 rounded-2xl shadow-[0_4px_0_0_#c2410c] active:shadow-none active:translate-y-1 transition-all disabled:opacity-50"
          >
            {savingGoal ? 'A guardar...' : 'Confirmar objetivo'}
          </button>
        </div>
      )}

      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-[radial-gradient(circle_at_top_left,#dff7ea,transparent_36%),linear-gradient(135deg,#ffffff_0%,#f5fff9_48%,#eff6ff_100%)] p-5 shadow-[0_28px_90px_-48px_rgba(15,23,42,0.45)] md:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[2rem] border-4 border-white bg-white shadow-lg shadow-emerald-600/10 ${!profile?.avatar_url ? 'p-1' : ''}`}>
                  <img
                    src={profile?.avatar_url || APP_ICON_SRC}
                    alt="Avatar"
                    className={`h-full w-full ${profile?.avatar_url ? 'object-cover' : 'object-contain scale-[1.08]'}`}
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">Hoje</p>
                  <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
                    Ola, {profile?.full_name?.split(' ')[0] || 'Estudante'}
                  </h1>
                  <p className="mt-2 text-sm font-medium text-slate-600">
                    O painel ficou mais curto para destacar o que merece atencao agora.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700">
                      <ShieldCheck className="h-4 w-4" />
                      {areaName}
                    </span>
                    {(profile as any)?.goal && (
                      <span className="inline-flex items-center gap-2 rounded-full bg-orange-100 px-3 py-1.5 text-xs font-bold text-orange-700">
                        <Target className="h-4 w-4" />
                        Meta: {(profile as any)?.goal}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <NotificationCenter />
            </div>

            <div className="rounded-[1.8rem] border border-emerald-200 bg-white/90 p-5 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">{trainingEyebrow}</p>
              <h2 className="mt-2 text-2xl font-black text-slate-900">{nextActionTitle}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{nextActionDescription}</p>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <Link
                  to={nextActionPath}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-4 text-sm font-black uppercase tracking-[0.12em] text-white transition hover:bg-emerald-700"
                >
                  <PlayCircle className="h-5 w-5" />
                  {nextActionLabel}
                </Link>
                <Link
                  to="/practice"
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <BookOpen className="h-5 w-5" />
                  Ver modos de estudo
                </Link>
              </div>
              {stats.dueQuestions > 0 && isPaidUser && (
                <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                  <Clock3 className="h-4 w-4" />
                  {stats.dueQuestions} revisoes pendentes hoje
                </div>
              )}
            </div>

            {profile?.role === 'elite' && (
              <div className="rounded-[1.8rem] border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-5 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">Elite</p>
                    <h3 className="mt-2 text-xl font-black text-slate-900">Plano de estudo personalizado</h3>
                    <p className="mt-2 text-sm text-slate-600">
                      {currentStrategy
                        ? 'O seu plano atual esta ativo. Recalibre apenas quando a semana pedir ajuste.'
                        : eliteGateResolved
                        ? 'Crie o plano e deixe o sistema organizar o foco das proximas sessoes.'
                        : 'Validando o seu fluxo Elite para evitar reabrir a criacao de plano sem necessidade.'}
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      onClick={() => navigate('/elite-assessment')}
                      disabled={!eliteGateResolved}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-500 px-5 py-3 text-sm font-black uppercase tracking-[0.12em] text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Target className="h-4 w-4" />
                      {!eliteGateResolved ? 'A verificar...' : currentStrategy ? 'Atualizar plano' : 'Criar plano'}
                    </button>
                    {currentStrategy && (
                      <button
                        onClick={() => navigate('/elite-plan-preview')}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-300 bg-white px-5 py-3 text-sm font-semibold text-amber-900 transition hover:bg-amber-50"
                      >
                        <Calendar className="h-4 w-4" />
                        Ver plano
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-[2rem] bg-slate-950 p-5 text-white shadow-[0_28px_80px_-44px_rgba(15,23,42,0.7)] md:p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-200">Resumo da semana</p>
            <h2 className="mt-3 text-2xl font-black">Como voce esta agora</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Em vez de muitos blocos concorrendo, ficam apenas os sinais que ajudam a decidir a proxima sessao.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.4rem] bg-white/5 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-200">Ofensiva</p>
                <p className="mt-2 flex items-center gap-2 text-2xl font-black text-orange-300">
                  <Flame className="h-6 w-6 fill-current" />
                  {displayStreakCount} dias
                </p>
                <p className="mt-3 text-xs text-slate-400">{streakLoading ? 'A atualizar a semana...' : 'Check-in diario real'}</p>
                <div className="mt-3 flex gap-1">
                  {streakWeek.map((day) => (
                    <div
                      key={day.date}
                      className={`flex-1 rounded-lg border px-2 py-2 text-center text-[10px] font-black ${day.completed ? 'border-orange-300 bg-white text-orange-700' : 'border-transparent bg-white/5 text-slate-500'}`}
                      title={day.date}
                    >
                      <div>{day.label}</div>
                      <div className="mt-1 flex justify-center">
                        {day.completed ? <CheckCircle className="h-3.5 w-3.5 text-emerald-300" /> : <Circle className="h-3.5 w-3.5 text-slate-600" />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.4rem] bg-white/5 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-yellow-200">XP total</p>
                <p className="mt-2 flex items-center gap-2 text-2xl font-black text-yellow-300">
                  <Award className="h-6 w-6" fill="currentColor" />
                  {profile?.total_xp || 0}
                </p>
                {(profile?.total_xp || 0) >= 1000 && !profile?.streak_freeze_active && (
                  <button
                    onClick={handleBuyStreakFreeze}
                    disabled={freezingStreak}
                    className="mt-3 inline-flex items-center gap-2 rounded-xl bg-blue-500/15 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-blue-100 transition hover:bg-blue-500/20 disabled:opacity-50"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    {freezingStreak ? 'A proteger...' : 'Proteger ofensiva'}
                  </button>
                )}
              </div>

              <div className="rounded-[1.4rem] bg-white/5 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-200">Ultimo simulado</p>
                <p className="mt-2 flex items-center gap-2 text-2xl font-black text-white">
                  <Clock3 className="h-6 w-6 text-sky-300" />
                  {statsLoading ? '...' : `${stats.lastSimScore}%`}
                </p>
                <p className="mt-3 text-xs text-slate-400">
                  {statsLoading ? 'Atualizando o historico mais recente.' : 'Resultado mais recente em prova completa.'}
                </p>
              </div>

              <div className="rounded-[1.4rem] bg-white/5 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200">Revisoes</p>
                <p className="mt-2 flex items-center gap-2 text-2xl font-black text-white">
                  <CheckCircle className="h-6 w-6 text-emerald-300" />
                  {statsLoading ? '...' : stats.dueQuestions}
                </p>
                <p className="mt-3 text-xs text-slate-400">
                  {statsLoading ? 'Sincronizando revisoes do dia.' : 'Itens prontos para retomar hoje.'}
                </p>
              </div>
            </div>

            <div className="mt-6">
              <Link
                to="/leagues"
                className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-200 transition hover:text-white"
              >
                Abrir ligas
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {stats.dueQuestions > 0 && isPaidUser && (
        <section className="rounded-[2rem] border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-[1.4rem] bg-white text-emerald-600 shadow-sm">
                <Clock3 className="h-7 w-7" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">Atencao agora</p>
                <h2 className="mt-1 text-xl font-black text-slate-900">Revisoes prontas para hoje</h2>
                <p className="mt-1 text-sm text-slate-700">
                  Ha <span className="font-black text-emerald-700">{stats.dueQuestions} questoes</span> a pedir continuidade.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Link
                to={reviewPath}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-white transition hover:bg-emerald-700"
              >
                <PlayCircle className="h-5 w-5" />
                Abrir revisao
              </Link>
              <Link
                to="/practice"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-600 bg-white px-6 py-4 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
              >
                <BookOpen className="h-5 w-5" />
                Ver todos os modos
              </Link>
            </div>
          </div>
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {quickLinks.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-[1.7rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className={`inline-flex rounded-2xl p-3 ${quickLinkToneStyles[item.tone]}`}>
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-black text-slate-900">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
              <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                Abrir
                <ArrowRight className="h-4 w-4" />
              </div>
            </Link>
          );
        })}
      </section>

      {perms.hasWeaknessRadar && (
        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_24px_80px_-44px_rgba(15,23,42,0.4)] md:p-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Desempenho</p>
              <h2 className="mt-1 text-xl font-black text-slate-900">Dominio por topico</h2>
            </div>
            <p className="text-sm text-slate-500">O radar detalhado fica abaixo do painel principal para nao competir com a acao do dia.</p>
          </div>
          <div className="mt-5 space-y-4">
            {topicProgress.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                Ainda nao existem respostas registadas. Comece a treinar para ver o seu dominio crescer.
              </p>
            ) : (
              topicProgress.map((progress, idx) => (
                <div key={idx} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="font-semibold text-slate-800">{progress.topics?.name}</span>
                    <span className="text-sm font-bold text-slate-500">{Math.round(progress.domain_score)}%</span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-slate-200">
                    <div
                      className={`h-2.5 rounded-full ${
                        progress.domain_score >= 80
                          ? 'bg-emerald-500'
                          : progress.domain_score >= 50
                            ? 'bg-orange-500'
                            : 'bg-red-500'
                      }`}
                      style={{ width: `${progress.domain_score}%` }}
                    ></div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <section className="grid gap-6 md:grid-cols-2">
        <DailyTasks />
        <AIMentor />
      </section>
    </div>
  );
}
