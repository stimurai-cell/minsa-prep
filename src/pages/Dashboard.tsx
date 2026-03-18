import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Award,
  BarChart2,
  BookOpen,
  CheckCircle,
  Clock3,
  Lock,
  PlayCircle,
  Target,
  Crown,
  Zap,
  Flame,
  ShieldCheck,
  Download,
  WifiOff,
  CreditCard,
  ArrowRight,
  Circle,
  Calendar
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { createStudyPlanForUser } from '../lib/studyPlan';
import { premiumPlans } from '../lib/premium';
import { useAuthStore } from '../store/useAuthStore';
import { useAppStore } from '../store/useAppStore';
import AreaLockCard from '../components/AreaLockCard';
import { UserPlus, Sparkles, Award as AwardIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DailyTasks from '../components/DailyTasks';
import AIMentor from '../components/AIMentor';
import NotificationCenter from '../components/NotificationCenter';
import { useOfflineStore } from '../store/useOfflineStore';
import { usePermissions } from '../lib/permissions';
import { EliteStrategyManager } from '../lib/eliteStrategy';

const DAILY_TIPS = [
  "Treinar 15 minutos todos os dias gera mais resultado do que estudar 3 horas só no domingo!",
  "A consistência é a chave da aprovação. Não quebre a sua ofensiva!",
  "Revise as questões que você errou; é ali que o aprendizado acontece de verdade.",
  "Estudar com amigos ajuda a manter o foco. Que tal convidar alguém na aba Social?",
  "Fazer simulados ajuda a controlar o tempo e o nervosismo para o dia da prova real."
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const { areas, fetchAreas } = useAppStore();
  const { questionCount, lastDownloadAt } = useOfflineStore();
  const perms = usePermissions();
  const isPaidUser = perms.canAccessSimulation;
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [stats, setStats] = useState({
    totalQuestions: 0,
    avgScore: 0,
    lastSimScore: 0,
    dueQuestions: 0,
  });
  const [topicProgress, setTopicProgress] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [missingGoal, setMissingGoal] = useState('');
  const [savingGoal, setSavingGoal] = useState(false);
  const [freezingStreak, setFreezingStreak] = useState(false);
  const [lastTaskCount, setLastTaskCount] = useState<number | null>(null);
  const [streakWeek, setStreakWeek] = useState<{ label: string; completed: boolean; date: string }[]>([]);
  const [streakLoading, setStreakLoading] = useState(false);
  const { deferredPrompt, setDeferredPrompt } = useAppStore();
  const [showEliteWelcome, setShowEliteWelcome] = useState(false);
  const [currentStrategy, setCurrentStrategy] = useState<any>(null);

  const dailyTip = useMemo(() => {
    const day = new Date().getDay();
    return DAILY_TIPS[day % DAILY_TIPS.length];
  }, []);

  const lastOfflineSyncLabel = useMemo(() => {
    if (!lastDownloadAt) return 'Ainda sem pacote local';

    try {
      return new Date(lastDownloadAt).toLocaleString('pt-PT');
    } catch {
      return 'Ultima sincronizacao indisponivel';
    }
  }, [lastDownloadAt]);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, []);

  useEffect(() => {
    fetchAreas();
  }, [fetchAreas]);

  useEffect(() => {
    if (showEliteWelcome) {
      navigate('/elite-welcome');
    }
  }, [showEliteWelcome, navigate]);

  // Check Elite user onboarding
  useEffect(() => {
    const checkEliteOnboarding = async () => {
      if (!profile?.id || profile?.role !== 'elite') return;

      try {
        // Verificar se usuário Elite precisa completar onboarding (incluindo upgrade de plano)
        if (profile?.role === 'elite') {
          const { data: onboarding } = await supabase
            .from('elite_onboarding')
            .select('completed, completed_at')
            .eq('user_id', profile.id)
            .single();

          // Se não tem onboarding ou se completed_at é anterior a possível upgrade recente
          if (!onboarding?.completed) {
            setShowEliteWelcome(true);
            return;
          }
          
          // Verificar se o usuário fez upgrade recentemente (comparando data do onboarding com data possível de upgrade)
          // Se o onboarding foi completado muito antes de ser Elite, mostrar novamente
          if (onboarding.completed_at) {
            const onboardingDate = new Date(onboarding.completed_at);
            const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            
            // Se o onboarding foi há mais de uma semana e agora é Elite, provavelmente fez upgrade
            if (onboardingDate < oneWeekAgo) {
              setShowEliteWelcome(true);
              return;
            }
          }
        }

        // Load current strategy
        const strategy = await EliteStrategyManager.getCurrentWeekStrategy(profile.id);
        if (strategy) {
          setCurrentStrategy(strategy);
        } else {
          const { data: legacyPlan } = await supabase
            .from('study_plans')
            .select('plan_json')
            .eq('user_id', profile.id)
            .order('generated_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          setCurrentStrategy(legacyPlan?.plan_json || null);
        }

        // Check if week needs reassessment
        const needsReassessment = await EliteStrategyManager.checkWeekCompletion(profile.id);
        if (needsReassessment) {
          await EliteStrategyManager.completeWeekAndReassess(profile.id);
          // Reload strategy
          const newStrategy = await EliteStrategyManager.getCurrentWeekStrategy(profile.id);
          setCurrentStrategy(newStrategy);
        }
      } catch (error) {
        console.error('Error checking elite onboarding:', error);
      }
    };

    checkEliteOnboarding();
  }, [profile]);

  // Autoreservar Notificações
  useEffect(() => {
    const askForNotifications = async () => {
      if ("Notification" in window && Notification.permission === "default") {
        try {
          const permission = await Notification.requestPermission();
          if (permission === "granted") {
            new Notification("Notificações Ativadas!", {
              body: "Agora você receberá lembretes de estudo e novidades do MINSA Prep.",
              icon: "https://res.cloudinary.com/dzvusz0u4/image/upload/v1773051625/qosfbrnflucygej3us4h.png"
            });
          }
        } catch (error) {
          console.error('Error requesting notification permission:', error);
        }
      }
    };
    askForNotifications();
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      if (!profile?.id) {
        setLoading(false);
        return;
      }

      try {
        const { data: progressData } = await supabase
          .from('user_topic_progress')
          .select('questions_answered, correct_answers, domain_score, topics!inner(name, area_id)')
          .eq('user_id', profile.id)
          .eq('topics.area_id', profile.selected_area_id);

        let totalQ = 0;
        let totalC = 0;

        if (progressData) {
          totalQ = progressData.reduce((acc, p) => acc + (p.questions_answered || 0), 0);
          totalC = progressData.reduce((acc, p) => acc + (p.correct_answers || 0), 0);
          setTopicProgress(progressData);
        }

        const avg = totalQ > 0 ? Math.round((totalC / totalQ) * 100) : 0;

        const { data: simData } = await supabase
          .from('quiz_attempts')
          .select('score')
          .eq('user_id', profile.id)
          .eq('is_completed', true)
          .order('completed_at', { ascending: false })
          .limit(1);

        const lastSim = simData && simData.length > 0 ? simData[0].score : 0;

        const { count: dueCount } = await supabase
          .from('user_question_srs')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', profile.id)
          .lte('next_review', new Date().toISOString());

        setStats({
          totalQuestions: totalQ,
          avgScore: avg,
          lastSimScore: lastSim,
          dueQuestions: dueCount || 0,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
        setLoading(false);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();

    // Gerar plano inteligente de estudo se ainda nao existir
    if (profile?.id) {
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
  }, [profile?.id]);

  // Mapa de ofensiva da semana (igual ao duolingo: check-in diario real, nada de numero fixo)
  useEffect(() => {
    if (!profile?.id) return;

    const fetchStreakWeek = async () => {
      setStreakLoading(true);
      try {
        const nowLuanda = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Luanda' }));
        const start = new Date(nowLuanda);
        start.setDate(start.getDate() - 6);

        const startIso = new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())).toISOString();

        const { data, error } = await supabase
          .from('activity_logs')
          .select('created_at')
          .eq('user_id', profile.id)
          .eq('activity_type', 'xp_earned')
          .gte('created_at', startIso);

        if (error) throw error;

        const dayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
        const doneSet = new Set(
          (data || []).map((d: any) => new Date(d.created_at).toISOString().slice(0, 10))
        );

        const week = Array.from({ length: 7 }).map((_, idx) => {
          const d = new Date(start);
          d.setDate(start.getDate() + idx);
          const iso = d.toISOString().slice(0, 10);
          return {
            label: dayLabels[d.getDay()],
            completed: doneSet.has(iso),
            date: iso,
          };
        });

        setStreakWeek(week);
      } catch (err) {
        console.error('Erro ao buscar ofensiva semanal:', err);
        setStreakLoading(false);
      } finally {
        setStreakLoading(false);
      }
    };

    fetchStreakWeek();
  }, [profile?.id]);

  // Daily Tasks Completion check
  useEffect(() => {
    if (!profile?.id) return;

    const monitorTasks = async () => {
      const { getDailyTasksProgress } = await import('../lib/dailyTasks');
      const tasks = await getDailyTasksProgress(profile.id);
      const completedNow = tasks.filter(t => t.completed).length;

      if (lastTaskCount !== null && completedNow > lastTaskCount) {
        // Task completed!
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("Tarefa Concluída! 🎉", {
            body: "Você deu mais um passo importante na sua preparação. Continue assim!",
            icon: "https://res.cloudinary.com/dzvusz0u4/image/upload/v1773051625/qosfbrnflucygej3us4h.png"
          });
        }
      }
      setLastTaskCount(completedNow);
    };

    monitorTasks();
    const interval = setInterval(monitorTasks, 30000);
    return () => clearInterval(interval);
  }, [profile?.id, lastTaskCount]);

  const areaName = useMemo(
    () => areas.find((area) => area.id === profile?.selected_area_id)?.name || 'Área ainda não definida',
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-emerald-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-amber-200 border-t-amber-600"></div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2 mt-4">Carregando seu painel</h2>
          <p className="text-slate-600">Preparando tudo para você...</p>
        </div>
      </div>
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
      const { error } = await supabase.from('profiles').update({
        streak_freeze_active: true,
        total_xp: (profile.total_xp || 0) - 1000,
        last_streak_freeze_at: new Date().toISOString()
      }).eq('id', profile.id);

      if (error) throw error;
      alert('Proteção de Ofensiva ativada! Sua sequência está protegida por 24h.');
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert('Erro ao ativar proteção.');
    } finally {
      setFreezingStreak(false);
    }
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    }
    setDeferredPrompt(null);
  };

  return (
    <div className="space-y-5 md:space-y-8">

      {/* Aviso para utilizadores antigos sem meta definida */}
      {(profile as any)?.goal === null && (
        <div className="bg-orange-50 border-2 border-orange-200 rounded-[2rem] p-6 shadow-sm flex flex-col items-center text-center animate-in zoom-in duration-300">
          <Target className="w-12 h-12 text-orange-500 mb-4" />
          <h2 className="text-2xl font-black text-slate-800 mb-2">Qual é o seu foco principal?</h2>
          <p className="text-slate-600 mb-6">Defina o que deseja alcançar com os seus estudos para acompanharmos a sua evolução.</p>

          <select
            value={missingGoal}
            onChange={(e) => setMissingGoal(e.target.value)}
            className="w-full max-w-sm rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-400 mb-4"
          >
            <option value="" disabled>Selecione o seu objetivo principal</option>
            <option value="Aprender e rever conceitos">Aprender e rever conceitos</option>
            <option value="Passar no concurso público">Passar no concurso público</option>
            <option value="Descontrair e treinar">Descontrair e treinar</option>
            <option value="Testar minhas habilidades">Testar as minhas habilidades</option>
          </select>

          <button
            onClick={handleSaveMissingGoal}
            disabled={!missingGoal || savingGoal}
            className="w-full max-w-sm bg-orange-500 hover:bg-orange-600 text-white font-bold py-3.5 rounded-2xl shadow-[0_4px_0_0_#c2410c] active:shadow-none active:translate-y-1 transition-all disabled:opacity-50"
          >
            {savingGoal ? 'A guardar...' : 'Confirmar Objetivo'}
          </button>
        </div>
      )}

      {/* Banner Pacote Offline — mostra para todos que ainda não compraram o pacote */}
      {isOnline && !perms.hasOfflinePackage && profile?.role !== 'admin' && (
        <div
          onClick={() => navigate('/premium')}
          className="cursor-pointer rounded-[2rem] overflow-hidden border border-slate-200 bg-gradient-to-r from-slate-800 to-slate-700 p-5 md:p-6 shadow-xl flex flex-col sm:flex-row items-center gap-5 hover:shadow-2xl transition-all group"
        >
          <div className="relative shrink-0">
            <div className="w-16 h-16 rounded-[1.5rem] bg-emerald-500/20 border-2 border-emerald-400/30 flex items-center justify-center">
              <WifiOff className="w-8 h-8 text-emerald-400" />
            </div>
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-400 rounded-full border-2 border-slate-800 flex items-center justify-center">
              <Zap className="w-3 h-3 text-slate-900 fill-current" />
            </div>
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h3 className="text-lg font-black text-white tracking-tight">Offline agora vem no Premium e no Elite</h3>
            <p className="mt-1 text-slate-300 text-sm font-medium">
              Atualize para um dos planos principais e leve o Treino Diario e o Modo Relampago consigo, mesmo sem internet.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-[1.5rem] bg-white px-6 py-3 text-sm font-black uppercase tracking-tight text-slate-900 shadow-lg hover:scale-105 active:scale-95 transition-all shrink-0 group-hover:bg-emerald-50">
            <CreditCard className="h-4 w-4" />
            Ver planos
          </div>
        </div>
      )}

      {perms.hasOfflinePackage && (
        <div className="rounded-[2rem] border border-emerald-200 bg-[radial-gradient(circle_at_top_right,#d9ffe9,transparent_35%),linear-gradient(135deg,#ffffff_0%,#f7fff9_55%,#eefcf6_100%)] p-5 shadow-[0_24px_70px_-42px_rgba(16,185,129,0.35)] md:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.4rem] bg-emerald-600 text-white shadow-lg shadow-emerald-500/20">
                {!isOnline ? <WifiOff className="h-7 w-7" /> : <Download className="h-7 w-7" />}
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">Offline Premium e Elite</p>
                <h3 className="mt-2 text-2xl font-black text-slate-900">Treino Diario e Modo Relampago prontos para continuar sem internet</h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  O sistema guarda um pacote local da sua area para manter as rotinas mais rapidas sempre disponiveis.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[420px]">
              <div className="rounded-[1.4rem] border border-white bg-white/80 px-4 py-4 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Questoes locais</p>
                <p className="mt-2 text-2xl font-black text-slate-900">{questionCount}</p>
              </div>
              <div className="rounded-[1.4rem] border border-white bg-white/80 px-4 py-4 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Sincronizacao</p>
                <p className="mt-2 text-sm font-black text-slate-900">{lastOfflineSyncLabel}</p>
              </div>
              <div className="rounded-[1.4rem] border border-white bg-white/80 px-4 py-4 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Estado</p>
                <p className={`mt-2 text-sm font-black ${!isOnline ? 'text-orange-600' : 'text-emerald-700'}`}>
                  {!isOnline ? 'Offline em uso' : questionCount > 0 ? 'Pacote ativo' : 'Preparando pacote'}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 md:flex-row">
            <Link
              to="/training"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-700"
            >
              Abrir treino guiado
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {questionCount === 0 && (
            <div className="mt-4 rounded-[1.4rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
              O pacote offline esta ativo e sera preparado silenciosamente enquanto este dispositivo tiver internet.
            </div>
          )}
        </div>
      )}

      {/* Dica do dia */}
      <div className="rounded-[1.5rem] bg-indigo-50 border border-indigo-100 p-4 flex items-start gap-4">
        <div className="p-2 bg-indigo-100 rounded-xl text-indigo-600 shrink-0">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-800 mb-1">Dica do Dia</p>
          <p className="text-sm font-medium text-indigo-900">{dailyTip}</p>
        </div>
      </div>

      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-[radial-gradient(circle_at_top_left,#dff7ea,transparent_36%),linear-gradient(135deg,#ffffff_0%,#f5fff9_48%,#eff6ff_100%)] p-5 shadow-[0_28px_90px_-48px_rgba(15,23,42,0.45)] md:p-8">
        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-5">
            <div className="flex items-center gap-6">
              <div className={`w-24 h-24 rounded-full border-4 border-white bg-white flex items-center justify-center shadow-lg shadow-emerald-600/10 overflow-hidden relative ${!profile?.avatar_url ? 'p-1' : ''}`}>
                <img
                  src={profile?.avatar_url || "https://res.cloudinary.com/dzvusz0u4/image/upload/v1773051625/qosfbrnflucygej3us4h.png"}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">Painel do estudante</p>
                <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
                  Olá, {profile?.full_name?.split(' ')[0] || 'Estudante'}
                </h1>
                {(profile as any)?.goal && (
                  <p className="mt-2 inline-flex items-center gap-2 rounded-xl bg-orange-100 px-3 py-1.5 text-xs font-bold text-orange-700">
                    <Target className="w-4 h-4" />
                    Meta: {(profile as any)?.goal}
                  </p>
                )}
              </div>
              <div className="ml-auto flex items-center gap-2">
                <NotificationCenter />
              </div>
            </div>

            {/* Elite Study Plan - always visible for Elite */}
            {profile?.role === 'elite' && (
              <div className="rounded-[2rem] border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-6 shadow-sm">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center">
                    <Target className="w-6 h-6 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">Plano de Estudo Elite</h3>
                    <p className="text-sm text-slate-600">
                      {currentStrategy ? 'Atualize ou veja seu plano ativo' : 'Crie seu plano personalizado para acelerar sua aprovação'}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => navigate('/elite-assessment')}
                    className="flex-1 bg-gradient-to-r from-amber-500 to-emerald-500 text-white font-black px-6 py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-3"
                  >
                    <Target className="w-5 h-5" />
                    {currentStrategy ? 'Atualizar plano / refazer avaliação' : 'Criar Plano de Estudo'}
                  </button>
                  {currentStrategy && (
                    <button
                      onClick={() => navigate('/elite-plan-preview')}
                      className="flex-1 border-2 border-amber-300 text-amber-800 font-bold px-6 py-4 rounded-2xl bg-white hover:bg-amber-50 transition-all flex items-center justify-center gap-3"
                    >
                      <Calendar className="w-5 h-5" />
                      Ver plano atual
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[1.6rem] border-2 border-orange-100 bg-orange-50 shadow-[0_6px_0_0_#ffedd5] p-4 md:p-5 flex flex-col gap-3 transition-transform hover:-translate-y-1 relative group">
                <p className="text-sm font-bold text-orange-600 uppercase tracking-widest">Ofensiva</p>
                <div className="flex items-center justify-between gap-3">
                  <p className="flex items-center gap-2 text-3xl font-black text-orange-600 leading-none">
                    <Flame className="h-7 w-7 fill-current" />
                    {(profile?.streak_count || 0)} dias
                  </p>
                  {profile?.streak_freeze_active ? (
                    <div className="bg-blue-500 text-white p-1 rounded-full animate-pulse" title="Protegido">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                  ) : (
                    (profile?.total_xp || 0) >= 1000 && (
                      <button
                        onClick={handleBuyStreakFreeze}
                        disabled={freezingStreak}
                        className="hidden group-hover:flex items-center gap-1 bg-blue-100 text-blue-600 px-2 py-1 rounded-lg text-[10px] font-bold border border-blue-200 transition-all"
                      >
                        <Zap className="w-3 h-3" /> {freezingStreak ? '...' : 'PROTEGER'}
                      </button>
                    )
                  )}
                </div>
                <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-[0.16em] text-orange-700">
                  <span>Esta semana</span>
                  <span className="text-orange-500">{streakLoading ? 'Atualizando...' : 'Check-in diario real'}</span>
                </div>
                <div className="flex items-center gap-2">
                  {streakWeek.map((day) => (
                    <div
                      key={day.date}
                      className={`flex-1 rounded-xl px-2 py-2 text-center border ${day.completed ? 'bg-white border-orange-200 text-orange-700 shadow-sm' : 'bg-orange-100 border-orange-200/60 text-orange-400'}`}
                      title={day.date}
                    >
                      <div className="text-[11px] font-black">{day.label}</div>
                      <div className="mt-1 flex items-center justify-center">
                        {day.completed ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <Circle className="w-4 h-4 text-orange-300" />}
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => navigate('/news?tab=achievements')}
                  className="mt-1 text-xs font-bold text-orange-700 underline-offset-2 hover:underline text-left"
                >
                  Ver linha do tempo da ofensiva
                </button>
              </div>
              <div className="rounded-[1.6rem] border border-white/60 bg-white/90 p-4 md:p-5">
                <p className="text-sm font-medium text-slate-500">Ultima simulacao de prova</p>
                <p className="mt-2 flex items-center gap-2 text-2xl font-black text-slate-900">
                  <Clock3 className="h-5 w-5 text-sky-600" />
                  {stats.lastSimScore}%
                </p>
              </div>
              <div className="rounded-[1.6rem] border-2 border-yellow-200 bg-yellow-50 shadow-[0_6px_0_0_#fef08a] p-4 md:p-5 flex flex-col justify-between transition-transform hover:-translate-y-1">
                <p className="text-sm font-bold text-yellow-700 uppercase tracking-widest">XP Total</p>
                <p className="mt-2 flex items-center gap-2 text-3xl font-black text-yellow-600">
                  <Award className="h-7 w-7" fill="currentColor" />
                  {profile?.total_xp || 0}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Spaced Repetition (SRS) Card - Available for all paid plans */}
      {stats.dueQuestions > 0 && isPaidUser && (
        <section className="animate-in slide-in-from-bottom duration-500">
          <div className="rounded-[2rem] border-2 border-emerald-200 bg-emerald-50 p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
            <div className="flex items-center gap-5 text-center md:text-left">
              <div className="w-16 h-16 bg-white rounded-[1.4rem] flex items-center justify-center text-emerald-600 shadow-sm shrink-0">
                <Clock3 className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-800">É hora de revisar!</h2>
                <p className="text-slate-600 font-medium">Você tem <span className="font-black text-emerald-600">{stats.dueQuestions} questões</span> prontas para revisão hoje.</p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mt-4">
            <Link
              to="/training"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-4 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              <PlayCircle className="h-5 w-5" />
              Iniciar treino
            </Link>
            <Link
              to="/onboarding-quiz"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-600 bg-white px-6 py-4 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
            >
              <PlayCircle className="h-5 w-5" />
              Quiz rápido
            </Link>
            <Link
              to="/simulation"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-6 py-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              <Clock3 className="h-5 w-5" />
              Fazer simulação de prova
            </Link>
            <Link
              to="/speed-mode"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-6 py-4 text-sm font-black uppercase tracking-tight text-slate-900 transition hover:bg-yellow-500 hover:scale-105 active:scale-95 shadow-[0_15px_30px_-12px_rgba(250,204,21,0.4)]"
            >
              <Zap className="h-5 w-5" fill="currentColor" />
              Modo Relâmpago
            </Link>
          </div>
        </section>
      )}

      {/* Card Especial Concurso (Apenas para quem tem esse objetivo) */}
      {(profile as any)?.goal === "Passar no concurso público" && (
        <div
          className="rounded-[2.5rem] border-2 border-slate-900 bg-[#0A1128] p-8 text-white shadow-2xl relative overflow-hidden group hover:scale-[1.01] transition-all cursor-pointer"
          onClick={() => navigate('/contest')}
        >
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 mb-5 border border-emerald-500/20">
              <Sparkles className="w-3.5 h-3.5" />
              Destaque Exclusivo
            </div>
            <h3 className="text-3xl md:text-4xl font-black tracking-tight leading-tight">
              Preparação para o <br />
              <span className="text-emerald-400">Concurso MINSA</span>
            </h3>
            <p className="mt-4 text-slate-400 text-sm font-medium pr-20 leading-relaxed max-w-xl">
              Acesse simulados focados 100% no edital de saúde: Legislação Nacional,
              Ética Profissional e Deontologia. Tudo em um só lugar.
            </p>
            <div className="mt-8 flex items-center gap-3 text-emerald-400 font-black text-[10px] uppercase tracking-[0.25em] group-hover:gap-5 transition-all">
              Abrir Módulo de Concurso
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>

          {/* Efeito visual de fundo */}
          <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl group-hover:bg-emerald-500/10 transition-colors"></div>
          <AwardIcon className="absolute -right-6 -bottom-6 w-40 h-40 text-white/5 rotate-12 group-hover:scale-110 group-hover:rotate-0 transition-all duration-500" />
        </div>
      )}

      {/* Domínio por tópico - apenas para Premium e acima */}
      {perms.hasWeaknessRadar && (
        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_24px_80px_-44px_rgba(15,23,42,0.4)] md:p-6">
          <h2 className="text-xl font-black text-slate-900">Dominio por topico</h2>
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
                      className={`h-2.5 rounded-full ${progress.domain_score >= 80
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

      <section className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        {/* Premium CTA */}
        {profile?.role === 'free' && (
          <div
            className="rounded-[2rem] border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-6 flex flex-col gap-4 shadow-sm cursor-pointer hover:shadow-md transition-all"
            onClick={() => navigate('/premium')}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
                <Crown className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-amber-600 mb-1">Plano Premium</p>
                <h3 className="font-black text-slate-900 text-lg leading-tight">Desbloqueie seu potencial total</h3>
              </div>
            </div>
            <p className="text-sm text-slate-600 font-medium leading-relaxed">
              Acesse questões ilimitadas, simulações avançadas e o plano de estudo personalizado para a sua aprovação.
            </p>
            <div className="flex items-center gap-2 text-amber-700 font-black text-sm">
              Ver planos disponíveis <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        )}
      </section>

      {/* Install App Banner */}
      {deferredPrompt && (
        <div className="rounded-[2rem] border border-slate-200 bg-gradient-to-r from-slate-900 to-slate-800 p-5 md:p-6 flex flex-col sm:flex-row items-center gap-5 shadow-xl">
          <div className="w-14 h-14 rounded-[1.4rem] bg-white/10 flex items-center justify-center shrink-0">
            <Download className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h3 className="text-lg font-black text-white">Instalar App no Dispositivo</h3>
            <p className="mt-1 text-slate-400 text-sm font-medium">
              Aceda ao MINSA Prep mais rápido, mesmo sem internet, diretamente do seu ecrã inicial.
            </p>
          </div>
          <button
            onClick={handleInstallClick}
            className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-900 hover:bg-slate-100 transition-all shrink-0"
          >
            <Download className="h-4 w-4" />
            Instalar
          </button>
        </div>
      )}
    </div>
  );
}
