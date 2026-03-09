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
  Download
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { createStudyPlanForUser } from '../lib/studyPlan';
import { premiumPlans } from '../lib/premium';
import { useAuthStore } from '../store/useAuthStore';
import { useAppStore } from '../store/useAppStore';
import AreaLockCard from '../components/AreaLockCard';
import { UserPlus, Sparkles, ArrowRight, Award as AwardIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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
  const [stats, setStats] = useState({
    totalQuestions: 0,
    avgScore: 0,
    lastSimScore: 0,
  });
  const [topicProgress, setTopicProgress] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [missingGoal, setMissingGoal] = useState('');
  const [savingGoal, setSavingGoal] = useState(false);
  const [freezingStreak, setFreezingStreak] = useState(false);

  const dailyTip = useMemo(() => {
    const day = new Date().getDay();
    return DAILY_TIPS[day % DAILY_TIPS.length];
  }, []);

  useEffect(() => {
    fetchAreas();
  }, [fetchAreas]);

  useEffect(() => {
    const fetchStats = async () => {
      if (!profile?.id) return;

      try {
        const { data: progressData } = await supabase
          .from('user_topic_progress')
          .select('questions_answered, correct_answers, domain_score, topics(name)')
          .eq('user_id', profile.id);

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

        setStats({
          totalQuestions: totalQ,
          avgScore: avg,
          lastSimScore: lastSim,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    // Gerar plano inteligente de estudo se ainda nao existir
    void (async () => {
      try {
        if (!profile?.id) return;
        const { data: existing } = await supabase.from('study_plans').select('id').eq('user_id', profile.id).maybeSingle();
        if (!existing) {
          await createStudyPlanForUser(profile as any);
        }
      } catch (err) {
        console.error('Erro ver/plano de estudo:', err);
      }
    })();
  }, [profile?.id]);

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
      <div className="flex justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-emerald-600"></div>
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

  const { deferredPrompt, setDeferredPrompt } = useAppStore();

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
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-full border-4 border-white bg-slate-100 flex items-center justify-center shadow-lg shadow-emerald-600/20 overflow-hidden relative">
              <span className="text-4xl font-black text-slate-400">
                {profile?.full_name?.charAt(0) || 'U'}
              </span>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">Painel do estudante</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
                Olá, {profile?.full_name?.split(' ')[0]}
              </h1>
              {(profile as any)?.goal && (
                <p className="mt-2 inline-flex items-center gap-2 rounded-xl bg-orange-100 px-3 py-1.5 text-xs font-bold text-orange-700">
                  <Target className="w-4 h-4" />
                  Meta: {(profile as any)?.goal}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.6rem] border-2 border-orange-100 bg-orange-50 shadow-[0_6px_0_0_#ffedd5] p-4 md:p-5 flex flex-col justify-between transition-transform hover:-translate-y-1 relative group">
              <p className="text-sm font-bold text-orange-600 uppercase tracking-widest">Ofensiva</p>
              <div className="mt-2 flex items-center justify-between">
                <p className="flex items-center gap-2 text-3xl font-black text-orange-600">
                  <Flame className="h-7 w-7 fill-current" />
                  2 Dias
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
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-[0_22px_70px_-46px_rgba(15,23,42,0.4)] md:p-6">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-blue-50 p-3 text-blue-600">
              <CheckCircle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Questoes resolvidas</p>
              <p className="text-3xl font-black text-slate-900">{stats.totalQuestions}</p>
            </div>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-[0_22px_70px_-46px_rgba(15,23,42,0.4)] md:p-6">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
              <BarChart2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Media geral</p>
              <p className="text-3xl font-black text-slate-900">{stats.avgScore}%</p>
            </div>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-[0_22px_70px_-46px_rgba(15,23,42,0.4)] md:p-6">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-orange-50 p-3 text-orange-600">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Área ativa</p>
              <p className="text-xl font-black text-slate-900">{areaName}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_24px_80px_-44px_rgba(15,23,42,0.4)] md:p-6">
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <h2 className="text-xl font-black text-slate-900">Sessão recomendada</h2>
              <p className="mt-1 text-sm text-slate-500">
                Conteúdo filtrado automaticamente para a sua área de estudo.
              </p>
            </div>
            <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">
              Prioridade
            </span>
          </div>

          <p className="mt-5 text-sm leading-6 text-slate-600">
            Com base no seu objetivo de {profile?.preparation_time_months} {profile?.preparation_time_months === 1 ? 'mês' : 'meses'} focado na sua formação em {areaName},
            preparamos um percurso de treino focado nos **tópicos principais** que você precisa dominar.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
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
        </div>

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
      </section >

      <section className="rounded-[2rem] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#fff8eb_40%,#f5fff7_100%)] p-5 shadow-[0_24px_80px_-44px_rgba(15,23,42,0.4)] md:p-6">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">Pacotes premium</p>
            <h2 className="mt-2 text-2xl font-black text-slate-900">Planos premium</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Escolha o plano que melhor se adequa ao seu objetivo de estudo.
            </p>
          </div>
          <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-600">
            Perfil atual: <span className="font-black text-slate-900">{profile?.role === 'premium' ? 'Premium' : 'Gratuito'}</span>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {premiumPlans.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-[1.7rem] border p-5 ${plan.highlight
                ? 'border-amber-300 bg-amber-50 shadow-[0_18px_50px_-40px_rgba(245,158,11,0.5)]'
                : 'border-slate-200 bg-white'
                }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${plan.highlight ? 'bg-amber-200 text-amber-900' : 'bg-slate-100 text-slate-600'
                  }`}>
                  {plan.badge}
                </span>
                {plan.highlight && <Crown className="h-5 w-5 text-amber-600" />}
              </div>
              <h3 className="mt-4 text-xl font-black text-slate-900">{plan.name}</h3>
              <p className="mt-1 text-sm font-semibold text-emerald-700">A partir de {plan.prices.monthly.label}/mês</p>
              <p className="mt-4 text-sm font-semibold text-slate-800">{plan.headline}</p>
              <p className="mt-3 text-sm leading-6 text-slate-600">{plan.description}</p>
              <div className="mt-4 space-y-2">
                {plan.features.map((feature) => (
                  <p key={feature} className="rounded-xl bg-white/80 px-3 py-2 text-sm text-slate-700">
                    {feature}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div >
  );
}
