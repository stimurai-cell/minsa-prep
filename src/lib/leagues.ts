export const LEAGUE_ORDER = ['Bronze', 'Prata', 'Ouro'] as const;

export type LeagueName = (typeof LEAGUE_ORDER)[number];

export const LEAGUE_COLORS: Record<string, string> = {
  Bronze: 'from-amber-400 via-orange-500 to-orange-600',
  Prata: 'from-slate-200 via-slate-400 to-slate-600',
  Ouro: 'from-yellow-300 via-amber-400 to-yellow-600',
};

export const LEAGUE_ICONS: Record<string, string> = {
  Bronze: '🥉',
  Prata: '🥈',
  Ouro: '🥇',
};

function getLagosDateParts(reference = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(reference);
  const getPart = (type: string) => parts.find((part) => part.type === type)?.value || '';

  return {
    year: Number(getPart('year')),
    month: Number(getPart('month')),
    day: Number(getPart('day')),
    weekday: getPart('weekday'),
    hour: Number(getPart('hour')),
    minute: Number(getPart('minute')),
    second: Number(getPart('second')),
  };
}

export function getLeagueWeekStart(reference = new Date()) {
  const { year, month, day, weekday } = getLagosDateParts(reference);
  const weekdayMap: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };

  const dayOffset = weekdayMap[weekday] ?? 0;
  const lagosDate = new Date(Date.UTC(year, month - 1, day));
  lagosDate.setUTCDate(lagosDate.getUTCDate() - dayOffset);

  return lagosDate.toISOString().slice(0, 10);
}

export function getLeagueTimeLeft(reference = new Date()) {
  const { year, month, day, weekday, hour, minute, second } = getLagosDateParts(reference);
  const weekdayMap: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };

  const currentDay = weekdayMap[weekday] ?? 1;
  const lagosNow = new Date(Date.UTC(year, month - 1, day, hour - 1, minute, second));
  const weekEnd = new Date(Date.UTC(year, month - 1, day, 22, 59, 59, 999));
  weekEnd.setUTCDate(weekEnd.getUTCDate() + (7 - currentDay));

  const diff = Math.max(weekEnd.getTime() - lagosNow.getTime(), 0);
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);

  return `${days}d ${hours}h ${minutes}m`;
}

export function getLeaguePromotionSlots(roomSize: number) {
  if (roomSize >= 15) return 5;
  if (roomSize >= 10) return 3;
  if (roomSize >= 5) return 2;
  if (roomSize >= 1) return 1;
  return 0;
}

export function getLeagueDemotionSlots(leagueName: string, roomSize: number) {
  if (leagueName === 'Bronze') return 0;
  if (roomSize >= 15) return 3;
  if (roomSize >= 10) return 2;
  if (roomSize >= 5) return 1;
  return 0;
}

export function getLeagueStepStatus(index: number, currentLeague: string) {
  const currentIndex = LEAGUE_ORDER.indexOf((currentLeague as LeagueName) || 'Bronze');

  if (index === currentIndex) return 'Atual';
  if (index === currentIndex - 1) return 'Abaixo';
  if (index === currentIndex + 1) return 'Acima';

  return index < currentIndex ? 'Base' : 'Topo';
}
