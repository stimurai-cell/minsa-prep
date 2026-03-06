import { Award, Gauge, Sparkles, Target } from 'lucide-react';
import { formatDuration, getPerformanceLabel } from '../lib/quiz';

interface SessionCelebrationProps {
  title: string;
  subtitle: string;
  xpEarned: number;
  accuracy: number;
  durationSeconds: number;
  primaryActionLabel: string;
  onPrimaryAction: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}

export default function SessionCelebration({
  title,
  subtitle,
  xpEarned,
  accuracy,
  durationSeconds,
  primaryActionLabel,
  onPrimaryAction,
  secondaryActionLabel,
  onSecondaryAction,
}: SessionCelebrationProps) {
  const performanceLabel = getPerformanceLabel(accuracy);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="overflow-hidden rounded-[2.2rem] border border-slate-200 bg-[radial-gradient(circle_at_top,#fff7bf,transparent_28%),linear-gradient(180deg,#ffffff_0%,#f5fbff_100%)] p-6 text-center shadow-[0_34px_90px_-52px_rgba(15,23,42,0.45)] md:p-10">
        <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-[linear-gradient(180deg,#7ee000_0%,#58c100_100%)] text-white shadow-[0_22px_60px_-30px_rgba(88,193,0,0.8)]">
          <Sparkles className="h-12 w-12" />
        </div>

        <h1 className="mt-6 text-4xl font-black tracking-tight text-yellow-500">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{subtitle}</p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-[1.7rem] border-4 border-yellow-300 bg-white p-5 shadow-[0_18px_40px_-34px_rgba(234,179,8,0.7)]">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-yellow-500">Total de XP</p>
            <div className="mt-4 flex items-center justify-center gap-2 text-4xl font-black text-yellow-500">
              <Award className="h-8 w-8" />
              {xpEarned}
            </div>
          </div>

          <div className="rounded-[1.7rem] border-4 border-lime-400 bg-white p-5 shadow-[0_18px_40px_-34px_rgba(132,204,22,0.7)]">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-lime-600">{performanceLabel}</p>
            <div className="mt-4 flex items-center justify-center gap-2 text-4xl font-black text-lime-600">
              <Target className="h-8 w-8" />
              {Math.round(accuracy)}%
            </div>
          </div>

          <div className="rounded-[1.7rem] border-4 border-sky-300 bg-white p-5 shadow-[0_18px_40px_-34px_rgba(56,189,248,0.7)]">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-sky-500">Super agil</p>
            <div className="mt-4 flex items-center justify-center gap-2 text-4xl font-black text-sky-500">
              <Gauge className="h-8 w-8" />
              {formatDuration(durationSeconds)}
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3">
          <button
            onClick={onPrimaryAction}
            className="rounded-2xl bg-sky-500 px-6 py-4 text-lg font-black uppercase tracking-[0.16em] text-white shadow-[0_16px_0_0_rgba(14,116,144,0.9)] transition hover:translate-y-[1px] hover:shadow-[0_14px_0_0_rgba(14,116,144,0.9)]"
          >
            {primaryActionLabel}
          </button>

          {secondaryActionLabel && onSecondaryAction && (
            <button
              onClick={onSecondaryAction}
              className="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              {secondaryActionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
