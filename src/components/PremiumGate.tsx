import { Crown, Lock, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

type PremiumGateProps = {
  title: string;
  description: string;
  featureList: string[];
  ctaLabel?: string;
};

export default function PremiumGate({
  title,
  description,
  featureList,
  ctaLabel = 'Ver pacotes premium',
}: PremiumGateProps) {
  return (
    <div className="rounded-[2rem] border border-amber-200 bg-[linear-gradient(135deg,#fff8eb_0%,#ffffff_46%,#f3fff6_100%)] p-6 shadow-[0_24px_70px_-44px_rgba(15,23,42,0.35)] md:p-8">
      <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-800">
        <Lock className="h-4 w-4" />
        Recurso premium
      </div>

      <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-black tracking-tight text-slate-900">{title}</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600 md:text-base">{description}</p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {featureList.map((feature) => (
              <div
                key={feature}
                className="rounded-[1.35rem] border border-white/80 bg-white/90 px-4 py-4 text-sm font-semibold text-slate-700"
              >
                <div className="flex items-start gap-3">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{feature}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="w-full max-w-sm rounded-[1.8rem] border border-amber-300 bg-slate-950 p-5 text-white shadow-[0_24px_70px_-44px_rgba(245,158,11,0.5)]">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-amber-400/20 p-3 text-amber-300">
              <Crown className="h-6 w-6" />
            </div>
            <div>
              <p className="text-lg font-black">Premium Focus</p>
              <p className="text-sm text-slate-300">Plano principal para conversao</p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-300">
            Desbloqueia os recursos mais procurados sem obrigar o estudante a saltar logo para o plano intensivo.
          </p>
          <Link
            to="/premium"
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(90deg,#facc15_0%,#34d399_100%)] px-5 py-4 text-sm font-black uppercase tracking-[0.14em] text-slate-950 transition hover:opacity-95"
          >
            {ctaLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
