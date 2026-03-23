import { ArrowRight, Shield, Sparkles, Trophy, TrendingUp } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { LEAGUE_COLORS, LEAGUE_ICONS } from '../lib/leagues';

export type LeagueWeeklyResult = {
  id: string;
  week_start_date: string;
  room_number: number | null;
  final_rank: number;
  room_size: number;
  xp_earned: number;
  outcome: 'promoted' | 'stayed' | 'demoted';
  previous_league: string;
  new_league: string;
  podium_position: number | null;
};

interface LeagueWeeklyResultModalProps {
  result: LeagueWeeklyResult | null;
  onContinue: () => void;
}

function getResultCopy(result: LeagueWeeklyResult) {
  if (result.outcome === 'promoted') {
    return {
      eyebrow: 'Subida Confirmada',
      title: `Parabens! Agora estas na ${result.new_league}`,
      body: `Fechaste a semana em #${result.final_rank} na Sala ${result.room_number || 1} com ${result.xp_earned} XP e ganhaste a promocao para a proxima liga.`,
      accent: 'text-emerald-700',
      badge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      ring: 'from-emerald-400 to-lime-500',
    };
  }

  if (result.outcome === 'demoted') {
    return {
      eyebrow: 'Nova Rodada',
      title: `Vais recomecar na ${result.new_league}`,
      body: `Terminaste a semana em #${result.final_rank} na Sala ${result.room_number || 1} com ${result.xp_earned} XP. A nova semana abre uma chance limpa para voltares a subir.`,
      accent: 'text-rose-700',
      badge: 'bg-rose-100 text-rose-700 border-rose-200',
      ring: 'from-rose-400 to-orange-500',
    };
  }

  return {
    eyebrow: 'Liga Encerrada',
    title: `Mantiveste a ${result.new_league}`,
    body: `Terminaste a semana em #${result.final_rank} na Sala ${result.room_number || 1} com ${result.xp_earned} XP e segues na mesma divisao para a nova rodada.`,
    accent: 'text-sky-700',
    badge: 'bg-sky-100 text-sky-700 border-sky-200',
    ring: 'from-sky-400 to-indigo-500',
  };
}

export default function LeagueWeeklyResultModal({
  result,
  onContinue,
}: LeagueWeeklyResultModalProps) {
  if (!result) return null;

  const copy = getResultCopy(result);
  const sameLeague = result.previous_league === result.new_league;
  const podiumLabel = result.podium_position
    ? `${result.podium_position}o lugar no podio`
    : `#${result.final_rank} entre ${result.room_size}`;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      >
        <motion.div
          initial={{ opacity: 0, y: 28, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 220, damping: 22 }}
          className="relative w-full max-w-xl overflow-hidden rounded-[2.6rem] border border-white/20 bg-[radial-gradient(circle_at_top,#fff7d6_0%,#ffffff_34%,#f8fbff_100%)] p-6 shadow-[0_40px_120px_-48px_rgba(15,23,42,0.85)] md:p-8"
        >
          <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-yellow-200/70 blur-3xl" />
          <div className="absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-sky-200/60 blur-3xl" />

          <div className="relative">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                  {copy.eyebrow}
                </p>
                <h2 className={`mt-3 text-3xl font-black tracking-tight ${copy.accent}`}>
                  {copy.title}
                </h2>
                <p className="mt-3 max-w-lg text-sm leading-6 text-slate-600">
                  {copy.body}
                </p>
              </div>

              <div className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${copy.badge}`}>
                Semana Fechada
              </div>
            </div>

            <div className="mt-8 flex items-center justify-center gap-3 md:gap-6">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className={`min-w-[120px] rounded-[2rem] bg-gradient-to-br ${LEAGUE_COLORS[result.previous_league] || LEAGUE_COLORS.Bronze} p-5 text-center text-white shadow-xl`}
              >
                <div className="text-4xl">{LEAGUE_ICONS[result.previous_league] || LEAGUE_ICONS.Bronze}</div>
                <p className="mt-2 text-sm font-black uppercase tracking-[0.16em]">Antes</p>
                <p className="mt-1 text-xl font-black">{result.previous_league}</p>
              </motion.div>

              <motion.div
                animate={sameLeague ? { scale: [1, 1.04, 1] } : { x: [0, 6, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                className={`flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br ${copy.ring} text-white shadow-lg`}
              >
                {sameLeague ? <Shield className="h-8 w-8" /> : <ArrowRight className="h-8 w-8" />}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className={`min-w-[120px] rounded-[2rem] bg-gradient-to-br ${LEAGUE_COLORS[result.new_league] || LEAGUE_COLORS.Bronze} p-5 text-center text-white shadow-xl ring-4 ring-white/40`}
              >
                <div className="text-4xl">{LEAGUE_ICONS[result.new_league] || LEAGUE_ICONS.Bronze}</div>
                <p className="mt-2 text-sm font-black uppercase tracking-[0.16em]">Agora</p>
                <p className="mt-1 text-xl font-black">{result.new_league}</p>
              </motion.div>
            </div>

            <div className="mt-8 grid gap-3 md:grid-cols-3">
              <div className="rounded-[1.8rem] border border-slate-200 bg-white/90 p-4 shadow-sm">
                <div className="flex items-center gap-2 text-slate-400">
                  <Trophy className="h-4 w-4" />
                  <p className="text-[10px] font-black uppercase tracking-[0.18em]">Resultado</p>
                </div>
                <p className="mt-3 text-lg font-black text-slate-900">{podiumLabel}</p>
              </div>

              <div className="rounded-[1.8rem] border border-slate-200 bg-white/90 p-4 shadow-sm">
                <div className="flex items-center gap-2 text-slate-400">
                  <TrendingUp className="h-4 w-4" />
                  <p className="text-[10px] font-black uppercase tracking-[0.18em]">XP Semanal</p>
                </div>
                <p className="mt-3 text-lg font-black text-slate-900">{result.xp_earned} XP</p>
              </div>

              <div className="rounded-[1.8rem] border border-slate-200 bg-white/90 p-4 shadow-sm">
                <div className="flex items-center gap-2 text-slate-400">
                  <Sparkles className="h-4 w-4" />
                  <p className="text-[10px] font-black uppercase tracking-[0.18em]">Sala</p>
                </div>
                <p className="mt-3 text-lg font-black text-slate-900">
                  {result.room_number || 1} de {result.room_size}
                </p>
              </div>
            </div>

            <button
              onClick={onContinue}
              className="mt-8 w-full rounded-[1.8rem] bg-sky-500 px-6 py-4 text-sm font-black uppercase tracking-[0.18em] text-white shadow-[0_10px_30px_-14px_rgba(14,165,233,0.95)] transition hover:-translate-y-0.5 hover:bg-sky-600"
            >
              Continuar
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
