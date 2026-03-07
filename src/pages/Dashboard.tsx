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
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { createStudyPlanForUser } from '../lib/studyPlan';
import { premiumPlans } from '../lib/premium';
import { useAuthStore } from '../store/useAuthStore';
import { useAppStore } from '../store/useAppStore';
import AreaLockCard from '../components/AreaLockCard';

export default function Dashboard() {
  const { profile } = useAuthStore();
  const { areas, fetchAreas } = useAppStore();
  const [stats, setStats] = useState({
    totalQuestions: 0,
    avgScore: 0,
    lastSimScore: 0,
  });
  const [topicProgress, setTopicProgress] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-5 md:space-y-8">
      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-[radial-gradient(circle_at_top_left,#dff7ea,transparent_36%),linear-gradient(135deg,#ffffff_0%,#f5fff9_48%,#eff6ff_100%)] p-5 shadow-[0_28px_90px_-48px_rgba(15,23,42,0.45)] md:p-8">
        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">Painel do estudante</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
              Olá, {profile?.full_name?.split(' ')[0]}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
              Entre, continue o seu ritmo, ganhe XP e acompanhe o progresso da sua área.
            </p>

            <div className="mt-5 inline-flex max-w-full items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-4 py-2 text-sm font-semibold text-emerald-800">
              <Lock className="h-4 w-4" />
              <span className="truncate">Area ativa: {areaName}</span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.6rem] border border-white/60 bg-white/90 p-4 md:p-5">
              <p className="text-sm font-medium text-slate-500">Plano</p>
              <p className="mt-2 flex items-center gap-2 text-2xl font-black text-slate-900">
                <Target className="h-5 w-5 text-emerald-600" />
                {profile?.preparation_time_months} {profile?.preparation_time_months === 1 ? 'mês' : 'meses'}
              </p>
            </div>
            <div className="rounded-[1.6rem] border border-white/60 bg-white/90 p-4 md:p-5">
              <p className="text-sm font-medium text-slate-500">Ultima simulacao de prova</p>
              <p className="mt-2 flex items-center gap-2 text-2xl font-black text-slate-900">
                <Clock3 className="h-5 w-5 text-sky-600" />
                {stats.lastSimScore}%
              </p>
            </div>
            <div className="rounded-[1.6rem] border border-white/60 bg-white/90 p-4 md:p-5">
              <p className="text-sm font-medium text-slate-500">XP total</p>
              <p className="mt-2 flex items-center gap-2 text-2xl font-black text-yellow-600">
                <Award className="h-5 w-5" />
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
            Baseado no seu plano de {profile?.preparation_time_months} {profile?.preparation_time_months === 1 ? 'mes' : 'meses'},
            preparamos um percurso de treino centrado na area {areaName}.
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
          </div>
        </div>

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
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#fff8eb_40%,#f5fff7_100%)] p-5 shadow-[0_24px_80px_-44px_rgba(15,23,42,0.4)] md:p-6">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">Pacotes premium</p>
            <h2 className="mt-2 text-2xl font-black text-slate-900">Estrutura comercial pronta para crescer</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              A melhor distribuicao e manter um gratuito forte, um premium principal para conversao e um intensivo para upsell.
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
              className={`rounded-[1.7rem] border p-5 ${
                plan.highlight
                  ? 'border-amber-300 bg-amber-50 shadow-[0_18px_50px_-40px_rgba(245,158,11,0.5)]'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${
                  plan.highlight ? 'bg-amber-200 text-amber-900' : 'bg-slate-100 text-slate-600'
                }`}>
                  {plan.badge}
                </span>
                {plan.highlight && <Crown className="h-5 w-5 text-amber-600" />}
              </div>
              <h3 className="mt-4 text-xl font-black text-slate-900">{plan.name}</h3>
              <p className="mt-1 text-sm font-semibold text-emerald-700">{plan.cadence}</p>
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
    </div>
  );
}
