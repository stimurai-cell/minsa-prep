import { CheckCircle2, Crown, Lock, Rocket, ShieldCheck, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { premiumPlans } from '../lib/premium';
import { useAuthStore } from '../store/useAuthStore';

const premiumComparisons = [
  {
    title: 'Gratuito forte para entrar',
    description:
      'O gratuito deve provar valor rapidamente: treino base, prova base e progresso essencial. Serve para gerar habito e confianca.',
  },
  {
    title: 'Premium Focus como plano principal',
    description:
      'Este deve ser o plano mais promovido no app. Entrega o que mais pesa na decisao de compra: filtros, ranking, revisao e historico de desempenho.',
  },
  {
    title: 'Premium Intensivo para upsell',
    description:
      'Pacote voltado para reta final, estudantes mais comprometidos ou campanhas sazonais de exames e concursos.',
  },
];

const premiumPerks = [
  'Escolha livre de nivel no treino e na prova',
  'Ranking completo da area',
  'Leitura mais profunda do historico de desempenho',
  'Melhor argumento comercial dentro do proprio app',
];

export default function Premium() {
  const { profile } = useAuthStore();
  const isPremium = profile?.role === 'premium' || profile?.role === 'admin';

  return (
    <div className="mx-auto max-w-6xl space-y-6 md:space-y-8">
      <section className="overflow-hidden rounded-[2.2rem] border border-slate-200 bg-[radial-gradient(circle_at_top_left,#fff3c4,transparent_28%),linear-gradient(135deg,#08121d_0%,#102033_56%,#114534_100%)] p-6 text-white shadow-[0_28px_90px_-48px_rgba(15,23,42,0.55)] md:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-amber-200">
              <Crown className="h-4 w-4" />
              Premium MINSA Prep
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">
              Estrutura premium pronta para vender sem confundir o estudante.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-200 md:text-base">
              O foco comercial correto nao e encher a plataforma de planos. E criar uma escada simples:
              gratuito para entrar, Premium Focus para converter e Intensivo para aumentar ticket.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <div className="rounded-2xl bg-white/10 px-4 py-3 text-sm">
                Perfil atual: <span className="font-black">{isPremium ? 'Premium' : 'Gratuito'}</span>
              </div>
              <div className="rounded-2xl bg-emerald-400/15 px-4 py-3 text-sm text-emerald-100">
                {isPremium ? 'Recursos premium ativos' : 'Alguns recursos premium ainda estao bloqueados'}
              </div>
            </div>
          </div>

          <div className="rounded-[1.8rem] border border-white/10 bg-white/10 p-5 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">O que deve vender mais</p>
            <div className="mt-4 space-y-3">
              {premiumPerks.map((perk) => (
                <div key={perk} className="flex items-start gap-3 rounded-2xl bg-white/10 px-4 py-3 text-sm text-slate-100">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                  <span>{perk}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {premiumComparisons.map((item, index) => {
          const Icon = index === 0 ? Rocket : index === 1 ? Star : ShieldCheck;

          return (
            <div
              key={item.title}
              className={`rounded-[1.8rem] border p-5 shadow-[0_24px_80px_-50px_rgba(15,23,42,0.35)] md:p-6 ${
                index === 1 ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="mt-4 text-xl font-black text-slate-900">{item.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">{item.description}</p>
            </div>
          );
        })}
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_24px_80px_-44px_rgba(15,23,42,0.35)] md:p-6">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">Planos</p>
            <h2 className="mt-2 text-2xl font-black text-slate-900">Oferta organizada para conversao</h2>
          </div>
          {!isPremium && (
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800">
              <Lock className="h-4 w-4" />
              O foco comercial deve empurrar o plano do meio
            </div>
          )}
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-3">
          {premiumPlans.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-[1.8rem] border p-5 ${
                plan.highlight
                  ? 'border-amber-300 bg-[linear-gradient(180deg,#fff4d6_0%,#ffffff_100%)] shadow-[0_24px_70px_-44px_rgba(245,158,11,0.45)]'
                  : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span
                  className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${
                    plan.highlight ? 'bg-amber-200 text-amber-900' : 'bg-white text-slate-600'
                  }`}
                >
                  {plan.badge}
                </span>
                {plan.highlight && <Crown className="h-5 w-5 text-amber-600" />}
              </div>
              <h3 className="mt-4 text-2xl font-black text-slate-900">{plan.name}</h3>
              <p className="mt-1 text-sm font-semibold text-emerald-700">{plan.cadence}</p>
              <p className="mt-4 text-sm font-semibold text-slate-800">{plan.headline}</p>
              <p className="mt-3 text-sm leading-6 text-slate-600">{plan.description}</p>
              <div className="mt-5 space-y-2">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-3 rounded-2xl bg-white/80 px-4 py-3 text-sm text-slate-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className={`mt-5 w-full rounded-2xl px-4 py-4 text-sm font-black uppercase tracking-[0.12em] transition ${
                  plan.highlight
                    ? 'bg-[linear-gradient(90deg,#facc15_0%,#34d399_100%)] text-slate-950'
                    : 'border border-slate-200 bg-white text-slate-700'
                }`}
              >
                {plan.id === 'starter'
                  ? 'Plano atual de entrada'
                  : isPremium
                    ? 'Plano pronto para ativacao comercial'
                    : 'Pedir activacao premium'}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <div className="rounded-[1.8rem] border border-emerald-200 bg-emerald-50 p-5">
          <h2 className="text-xl font-black text-slate-900">Posicionamento estrategico recomendado</h2>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
            <p>Deixa o gratuito entregar valor real, mas limita o que tem maior valor percebido e recorrencia.</p>
            <p>O ranking, o controlo de dificuldade e os relatórios mais densos devem puxar o estudante para o Premium Focus.</p>
            <p>Guarda o Intensivo para campanhas, reta final e perfis que ja deram sinais claros de compromisso.</p>
          </div>
        </div>

        <Link
          to="/dashboard"
          className="inline-flex items-center justify-center rounded-[1.6rem] bg-slate-950 px-6 py-4 text-sm font-bold text-white transition hover:bg-slate-800"
        >
          Voltar ao painel
        </Link>
      </section>
    </div>
  );
}
