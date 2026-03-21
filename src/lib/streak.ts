import { supabase } from './supabase';

export const STREAK_TIMEZONE = 'Africa/Luanda';

export type StreakWeekDay = {
  label: string;
  completed: boolean;
  date: string;
};

export type DailyStreakRegistrationResult = {
  streakCount: number;
  alreadyMarked: boolean;
  source: 'rpc' | 'streak_checkins' | 'activity_logs';
  checkinDate: string;
};

type StreakProfileState = {
  streak_count?: number | null;
  streak_freeze_active?: boolean | null;
};

type ActivityLogLike = {
  activity_date?: string | null;
  created_at?: string | null;
  activity_metadata?: Record<string, any> | null;
  streak_date?: string | null;
};

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const getDatePart = (parts: Intl.DateTimeFormatPart[], type: string) =>
  parts.find((part) => part.type === type)?.value || '';

export const getDateKeyInTimeZone = (date: Date = new Date(), timeZone = STREAK_TIMEZONE) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = getDatePart(parts, 'year');
  const month = getDatePart(parts, 'month');
  const day = getDatePart(parts, 'day');

  return `${year}-${month}-${day}`;
};

const parseDateKey = (dateKey: string) => new Date(`${dateKey}T00:00:00Z`);

const addDaysToDateKey = (dateKey: string, amount: number) => {
  const next = parseDateKey(dateKey);
  next.setUTCDate(next.getUTCDate() + amount);
  return next.toISOString().slice(0, 10);
};

const diffBetweenDateKeys = (fromDateKey: string, toDateKey: string) =>
  Math.round((parseDateKey(toDateKey).getTime() - parseDateKey(fromDateKey).getTime()) / DAY_IN_MS);

const normalizeDateKeys = (dateKeys: string[]) =>
  [...new Set(dateKeys.filter(Boolean))].sort((left, right) => right.localeCompare(left));

const resolveLogDateKey = (item: ActivityLogLike) => {
  const metadataDate = String(item?.activity_metadata?.streak_date || item?.streak_date || '').trim();
  if (metadataDate) return metadataDate;

  const rawDate = item?.activity_date || item?.created_at;
  return rawDate ? getDateKeyInTimeZone(new Date(rawDate)) : '';
};

const computeNextStreakState = (
  profile: StreakProfileState | null,
  lastDateKey: string | null,
  todayKey: string
) => {
  const currentStreak = Math.max(0, Number(profile?.streak_count || 0));
  let freezeActive = Boolean(profile?.streak_freeze_active);

  if (!lastDateKey) {
    return { streakCount: 1, freezeActive };
  }

  const dayGap = diffBetweenDateKeys(lastDateKey, todayKey);

  if (dayGap === 1) {
    return { streakCount: currentStreak + 1, freezeActive };
  }

  if (dayGap > 1) {
    if (freezeActive) {
      return { streakCount: currentStreak + 1, freezeActive: false };
    }

    return { streakCount: 1, freezeActive: false };
  }

  return { streakCount: currentStreak, freezeActive };
};

const loadProfileState = async (userId: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('streak_count, streak_freeze_active')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return (data || {}) as StreakProfileState;
};

const tryRegisterWithRpc = async (
  userId: string,
  todayKey: string
): Promise<DailyStreakRegistrationResult | null> => {
  try {
    const { data, error } = await supabase.rpc('register_daily_streak', {
      p_user_id: userId,
    });

    if (error) {
      return null;
    }

    return {
      streakCount: Number((data as any)?.streak_count || 0),
      alreadyMarked: Boolean((data as any)?.already_marked),
      source: 'rpc',
      checkinDate: todayKey,
    };
  } catch (error) {
    console.warn('[streak] RPC register_daily_streak indisponivel:', error);
    return null;
  }
};

const tryRegisterWithTableFallback = async (
  userId: string,
  todayKey: string
): Promise<DailyStreakRegistrationResult | null> => {
  try {
    const profile = await loadProfileState(userId);
    const { data: todayRow, error: todayError } = await supabase
      .from('streak_checkins')
      .select('streak_date')
      .eq('user_id', userId)
      .eq('streak_date', todayKey)
      .maybeSingle();

    if (todayError) {
      return null;
    }

    if (todayRow?.streak_date) {
      return {
        streakCount: Number(profile.streak_count || 0),
        alreadyMarked: true,
        source: 'streak_checkins',
        checkinDate: todayKey,
      };
    }

    const { data: recentRows, error: recentError } = await supabase
      .from('streak_checkins')
      .select('streak_date')
      .eq('user_id', userId)
      .lt('streak_date', todayKey)
      .order('streak_date', { ascending: false })
      .limit(1);

    if (recentError) {
      return null;
    }

    const lastDateKey = recentRows?.[0]?.streak_date || null;
    const nextStreakState = computeNextStreakState(profile, lastDateKey, todayKey);

    const { error: insertError } = await supabase.from('streak_checkins').insert({
      user_id: userId,
      streak_date: todayKey,
    });

    if (insertError) {
      return null;
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        streak_count: nextStreakState.streakCount,
        streak_freeze_active: nextStreakState.freezeActive,
      })
      .eq('id', userId);

    if (profileError) {
      return null;
    }

    return {
      streakCount: nextStreakState.streakCount,
      alreadyMarked: false,
      source: 'streak_checkins',
      checkinDate: todayKey,
    };
  } catch (error) {
    console.warn('[streak] Fallback streak_checkins indisponivel:', error);
    return null;
  }
};

const tryRegisterWithActivityLogFallback = async (
  userId: string,
  todayKey: string
): Promise<DailyStreakRegistrationResult | null> => {
  try {
    const profile = await loadProfileState(userId);
    const { data: logs, error: logsError } = await supabase
      .from('activity_logs')
      .select('activity_metadata, activity_date, created_at')
      .eq('user_id', userId)
      .eq('activity_type', 'daily_lesson_checkin')
      .order('created_at', { ascending: false })
      .limit(90);

    if (logsError) {
      return null;
    }

    const loggedDates = normalizeDateKeys((logs || []).map(resolveLogDateKey));

    if (loggedDates.includes(todayKey)) {
      return {
        streakCount: Number(profile.streak_count || 0),
        alreadyMarked: true,
        source: 'activity_logs',
        checkinDate: todayKey,
      };
    }

    const lastDateKey = loggedDates.find((dateKey) => dateKey < todayKey) || null;
    const nextStreakState = computeNextStreakState(profile, lastDateKey, todayKey);

    const { error: insertError } = await supabase.from('activity_logs').insert({
      user_id: userId,
      activity_type: 'daily_lesson_checkin',
      activity_date: new Date().toISOString(),
      activity_metadata: {
        source: 'lesson_completion',
        streak_date: todayKey,
      },
    });

    if (insertError) {
      return null;
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        streak_count: nextStreakState.streakCount,
        streak_freeze_active: nextStreakState.freezeActive,
      })
      .eq('id', userId);

    if (profileError) {
      return null;
    }

    return {
      streakCount: nextStreakState.streakCount,
      alreadyMarked: false,
      source: 'activity_logs',
      checkinDate: todayKey,
    };
  } catch (error) {
    console.error('[streak] Falha no fallback via activity_logs:', error);
    return null;
  }
};

export const registerDailyStreak = async (userId: string) => {
  if (!userId) return null;

  const todayKey = getDateKeyInTimeZone();

  return (
    (await tryRegisterWithRpc(userId, todayKey)) ||
    (await tryRegisterWithTableFallback(userId, todayKey)) ||
    (await tryRegisterWithActivityLogFallback(userId, todayKey))
  );
};

const fetchDateKeysFromStreakTable = async (userId: string, limit = 90) => {
  try {
    const { data, error } = await supabase
      .from('streak_checkins')
      .select('streak_date')
      .eq('user_id', userId)
      .order('streak_date', { ascending: false })
      .limit(limit);

    if (error) {
      return [];
    }

    return normalizeDateKeys((data || []).map((entry: any) => String(entry.streak_date || '')));
  } catch (error) {
    console.warn('[streak] Nao foi possivel ler streak_checkins:', error);
    return [];
  }
};

const fetchDateKeysFromActivityLogs = async (
  userId: string,
  activityType: string,
  limit = 90
) => {
  try {
    const { data, error } = await supabase
      .from('activity_logs')
      .select('activity_metadata, activity_date, created_at')
      .eq('user_id', userId)
      .eq('activity_type', activityType)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return [];
    }

    return normalizeDateKeys((data || []).map(resolveLogDateKey));
  } catch (error) {
    console.warn(`[streak] Nao foi possivel ler logs ${activityType}:`, error);
    return [];
  }
};

export const getCurrentStreakCount = (
  dateKeys: string[],
  referenceDate = getDateKeyInTimeZone()
) => {
  const completedDates = new Set(normalizeDateKeys(dateKeys));
  let cursor = referenceDate;

  if (!completedDates.has(cursor)) {
    cursor = addDaysToDateKey(referenceDate, -1);
    if (!completedDates.has(cursor)) {
      return 0;
    }
  }

  let streakCount = 0;

  while (completedDates.has(cursor)) {
    streakCount += 1;
    cursor = addDaysToDateKey(cursor, -1);
  }

  return streakCount;
};

export const buildStreakWeek = (
  dateKeys: string[],
  referenceDate = getDateKeyInTimeZone()
): StreakWeekDay[] => {
  const completedDates = new Set(normalizeDateKeys(dateKeys));
  const weekStart = addDaysToDateKey(referenceDate, -6);

  return Array.from({ length: 7 }, (_, index) => {
    const date = addDaysToDateKey(weekStart, index);
    const weekday = parseDateKey(date).getUTCDay();

    return {
      label: WEEKDAY_LABELS[weekday],
      completed: completedDates.has(date),
      date,
    };
  });
};

export const fetchStreakSnapshot = async (userId: string) => {
  const [tableDates, dailyLogDates, xpDates] = await Promise.all([
    fetchDateKeysFromStreakTable(userId),
    fetchDateKeysFromActivityLogs(userId, 'daily_lesson_checkin'),
    fetchDateKeysFromActivityLogs(userId, 'xp_earned'),
  ]);

  const allDates = normalizeDateKeys([...tableDates, ...dailyLogDates, ...xpDates]);

  return {
    recentDates: allDates,
    currentStreak: getCurrentStreakCount(allDates),
    week: buildStreakWeek(allDates),
  };
};
