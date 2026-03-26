import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Crown, Shield, TrendingUp } from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useAppStore } from '../store/useAppStore';
import LeagueWeeklyResultModal, { type LeagueWeeklyResult } from '../components/LeagueWeeklyResultModal';
import { syncUserWeeklyLeagueXp } from '../lib/xp';
import {
    LEAGUE_COLORS,
    LEAGUE_ICONS,
    LEAGUE_ORDER,
    getLeagueStepStatus,
    getLeagueTimeLeft,
    getLeagueWeekStart,
} from '../lib/leagues';

type LeagueEntry = {
    user_id: string;
    xp_earned: number;
    room_id: string | null;
    room_number: number | null;
    league_name: string;
    profiles: {
        full_name: string | null;
        avatar_url: string | null;
        selected_area_id: string | null;
    } | null;
};

type LeagueRoomSummary = {
    id: string;
    week_start_date: string;
    league_name: string;
    room_number: number;
    max_participants: number;
    participant_count: number;
    status: string;
    leaderboard: LeagueEntry[];
};

function normalizeLeagueEntries(rows: any[]): LeagueEntry[] {
    return (rows || []).map((row) => ({
        ...row,
        profiles: Array.isArray(row.profiles) ? row.profiles[0] || null : row.profiles || null,
    }));
}

export default function Leagues() {
    const navigate = useNavigate();
    const { profile, refreshProfile } = useAuthStore();
    const { areas, fetchAreas } = useAppStore();

    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<LeagueEntry[]>([]);
    const [currentRoom, setCurrentRoom] = useState<{
        id: string | null;
        roomNumber: number | null;
        leagueName: string;
    } | null>(null);
    const [adminRooms, setAdminRooms] = useState<LeagueRoomSummary[]>([]);
    const [timeLeft, setTimeLeft] = useState('');
    const [pendingResult, setPendingResult] = useState<LeagueWeeklyResult | null>(null);
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        void fetchAreas();
    }, [fetchAreas]);

    useEffect(() => {
        const updateTimer = () => {
            setTimeLeft(getLeagueTimeLeft());
        };

        updateTimer();
        const interval = setInterval(updateTimer, 60000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const fetchLeagueData = async () => {
            if (!profile?.id) {
                setLoading(false);
                return;
            }

            setLoading(true);
            setErrorMessage('');

            try {
                const weekStart = getLeagueWeekStart();
                const freshProfile = (await refreshProfile(profile.id)) || profile;

                const [{ data: ownStatData, error: ownStatError }, { data: result, error: resultError }] = await Promise.all([
                    supabase
                        .from('weekly_league_stats')
                        .select('user_id, xp_earned, room_id, room_number, league_name')
                        .eq('user_id', profile.id)
                        .eq('week_start_date', weekStart)
                        .maybeSingle(),
                    supabase
                        .from('league_results')
                        .select('id, week_start_date, room_number, final_rank, room_size, xp_earned, outcome, previous_league, new_league, podium_position')
                        .eq('user_id', profile.id)
                        .is('acknowledged_at', null)
                        .order('week_start_date', { ascending: false })
                        .limit(1)
                        .maybeSingle(),
                ]);

                if (ownStatError) throw ownStatError;
                if (resultError) throw resultError;

                let ownStat = ownStatData;
                if (!ownStat?.room_id || !ownStat?.room_number) {
                    const syncResult = await syncUserWeeklyLeagueXp(profile.id, weekStart);

                    if (syncResult.synced) {
                        const { data: repairedStat, error: repairedStatError } = await supabase
                            .from('weekly_league_stats')
                            .select('user_id, xp_earned, room_id, room_number, league_name')
                            .eq('user_id', profile.id)
                            .eq('week_start_date', weekStart)
                            .maybeSingle();

                        if (repairedStatError) throw repairedStatError;
                        ownStat = repairedStat;
                    }
                }

                let roomStats: LeagueEntry[] = [];
                const currentLeagueName = ownStat?.league_name || freshProfile?.current_league || 'Bronze';
                if (ownStat?.room_id) {
                    const { data: roomLeaderboard, error: roomError } = await supabase
                        .from('weekly_league_stats')
                        .select(`
                            user_id,
                            xp_earned,
                            room_id,
                            room_number,
                            league_name,
                            profiles(full_name, avatar_url, selected_area_id)
                        `)
                        .eq('week_start_date', weekStart)
                        .eq('room_id', ownStat.room_id)
                        .order('xp_earned', { ascending: false });

                    if (roomError) throw roomError;
                    roomStats = normalizeLeagueEntries(roomLeaderboard || []);
                } else if (ownStat) {
                    const { data: fallbackLeaderboard, error: fallbackError } = await supabase
                        .from('weekly_league_stats')
                        .select(`
                            user_id,
                            xp_earned,
                            room_id,
                            room_number,
                            league_name,
                            profiles(full_name, avatar_url, selected_area_id)
                        `)
                        .eq('week_start_date', weekStart)
                        .eq('league_name', currentLeagueName)
                        .order('xp_earned', { ascending: false });

                    if (fallbackError) throw fallbackError;
                    roomStats = normalizeLeagueEntries(
                        (fallbackLeaderboard && fallbackLeaderboard.length > 0)
                            ? fallbackLeaderboard
                            : [{ ...ownStat, profiles: null }]
                    );
                }

                let nextAdminRooms: LeagueRoomSummary[] = [];
                if (freshProfile?.role === 'admin') {
                    const [{ data: roomsData, error: roomsError }, { data: allStatsData, error: allStatsError }] = await Promise.all([
                        supabase
                            .from('league_rooms')
                            .select('id, week_start_date, league_name, room_number, max_participants, participant_count, status')
                            .eq('week_start_date', weekStart)
                            .order('room_number', { ascending: true }),
                        supabase
                            .from('weekly_league_stats')
                            .select(`
                                user_id,
                                xp_earned,
                                room_id,
                                room_number,
                                league_name,
                                profiles(full_name, avatar_url, selected_area_id)
                            `)
                            .eq('week_start_date', weekStart)
                            .not('room_id', 'is', null)
                            .order('xp_earned', { ascending: false }),
                    ]);

                    if (roomsError) throw roomsError;
                    if (allStatsError) throw allStatsError;

                    const leaderboardByRoom = new Map<string, LeagueEntry[]>();
                    normalizeLeagueEntries(allStatsData || []).forEach((entry) => {
                        const key = entry.room_id || '';
                        const currentEntries = leaderboardByRoom.get(key) || [];
                        currentEntries.push(entry);
                        leaderboardByRoom.set(key, currentEntries);
                    });

                    nextAdminRooms = ((roomsData || []) as Omit<LeagueRoomSummary, 'leaderboard'>[])
                        .map((room) => ({
                            ...room,
                            leaderboard: leaderboardByRoom.get(room.id) || [],
                        }))
                        .sort((a, b) => {
                            const leagueDiff = LEAGUE_ORDER.indexOf(a.league_name as any) - LEAGUE_ORDER.indexOf(b.league_name as any);
                            if (leagueDiff !== 0) return leagueDiff;
                            return a.room_number - b.room_number;
                        });
                }

                setStats(roomStats);
                setCurrentRoom(
                    ownStat
                        ? {
                            id: ownStat.room_id || `league-fallback-${weekStart}-${currentLeagueName}`,
                            roomNumber: ownStat.room_number,
                            leagueName: currentLeagueName,
                        }
                        : {
                            id: null,
                            roomNumber: null,
                            leagueName: freshProfile?.current_league || 'Bronze',
                        }
                );
                setPendingResult((result as LeagueWeeklyResult | null) || null);
                setAdminRooms(nextAdminRooms);
            } catch (error) {
                console.error('[Leagues] Erro ao carregar ligas:', error);
                setErrorMessage('Nao foi possivel carregar a tua liga agora. Tenta novamente em instantes.');
            } finally {
                setLoading(false);
            }
        };

        void fetchLeagueData();
    }, [profile?.id, profile?.role, refreshProfile]);

    const areaNameById = useMemo(() => {
        const map = new Map<string, string>();
        areas.forEach((area) => map.set(area.id, area.name));

        return (id?: string | null) => (id ? map.get(id) || 'Area nao definida' : 'Area nao definida');
    }, [areas]);

    const userRank = stats.findIndex((entry) => entry.user_id === profile?.id) + 1;
    const currentLeague = currentRoom?.leagueName || profile?.current_league || 'Bronze';
    const userWeeklyXp = userRank > 0 ? stats[userRank - 1]?.xp_earned || 0 : 0;

    const handleAcknowledgeResult = async () => {
        if (!pendingResult) return;

        const { data, error } = await supabase
            .rpc('acknowledge_league_result', { p_result_id: pendingResult.id });

        if (error) {
            console.error('[Leagues] Erro ao marcar resultado como visto:', error);
            return;
        }

        if (!data) {
            console.error('[Leagues] Resultado semanal nao foi confirmado para o utilizador atual.');
            return;
        }

        setPendingResult(null);
    };

    const renderLeaderboard = () => {
        if (loading) {
            return (
                <div className="p-20 text-center">
                    <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
                    <p className="mt-4 font-bold text-slate-400">Carregando a tua classificacao...</p>
                </div>
            );
        }

        if (errorMessage) {
            return (
                <div className="p-10 text-center">
                    <p className="font-bold text-rose-500">{errorMessage}</p>
                </div>
            );
        }

        if (!currentRoom?.id || stats.length === 0) {
            return (
                <div className="p-10 text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                        <Shield className="h-8 w-8" />
                    </div>
                    <h3 className="mt-5 text-xl font-black text-slate-900">Ainda nao tens classificacao esta semana</h3>
                    <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
                        Assim que ganhares XP, a tua liga comeca a aparecer aqui automaticamente.
                    </p>
                </div>
            );
        }

        return (
            <div className="divide-y divide-slate-50">
                {stats.map((entry, index) => {
                    const isUser = entry.user_id === profile?.id;
                    const placement = index + 1;

                    return (
                        <motion.div
                            initial={{ opacity: 0, x: -18 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.04 }}
                            key={entry.user_id}
                            onClick={() => navigate(`/profile/${entry.user_id}`)}
                            className={`flex cursor-pointer items-center gap-4 p-5 transition-colors ${isUser ? 'bg-indigo-50/60' : 'hover:bg-slate-50'}`}
                        >
                            <div className="w-8 text-center text-lg font-black text-slate-400">
                                {placement === 1 ? '🥇' : placement === 2 ? '🥈' : placement === 3 ? '🥉' : placement}
                            </div>

                            <div className="relative">
                                <div className={`flex h-12 w-12 items-center justify-center overflow-hidden rounded-full text-lg font-black shadow-md ${isUser ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                    {entry.profiles?.avatar_url ? (
                                        <img src={entry.profiles.avatar_url} alt="" className="h-full w-full object-cover" />
                                    ) : (
                                        entry.profiles?.full_name?.charAt(0) || '?'
                                    )}
                                </div>
                            </div>

                            <div className="min-w-0 flex-1">
                                <p className={`truncate font-bold ${isUser ? 'text-indigo-700' : 'text-slate-800'}`}>
                                    {entry.profiles?.full_name || 'Aluno MINSA'} {isUser ? '(Voce)' : ''}
                                </p>
                                <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                                    {areaNameById(entry.profiles?.selected_area_id)}
                                </p>
                            </div>

                            <div className="text-right">
                                <p className="text-lg font-black leading-none text-slate-900">{entry.xp_earned}</p>
                                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">XP semanal</p>
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="mx-auto max-w-4xl pb-24">
            <LeagueWeeklyResultModal result={pendingResult} onContinue={handleAcknowledgeResult} />

            <div className="mb-5 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Divisoes</p>
                        <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">Escala das ligas</h2>
                    </div>
                    <div className="rounded-2xl bg-slate-100 px-3 py-2 text-right">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Atual</p>
                        <p className="mt-1 text-sm font-black text-slate-900">{currentLeague}</p>
                    </div>
                </div>

                <div className="mt-4 overflow-x-auto pb-1">
                    <div className="flex min-w-max items-center gap-2">
                        {LEAGUE_ORDER.map((league, index) => {
                            const isCurrentLeague = league === currentLeague;
                            return (
                                <div key={league} className="flex items-center gap-2">
                                    <div
                                        className={`min-w-[94px] rounded-[1.5rem] border px-3 py-3 text-center transition ${isCurrentLeague
                                            ? 'border-slate-900 bg-slate-900 text-white shadow-lg'
                                            : 'border-slate-200 bg-slate-50 text-slate-500'
                                            }`}
                                    >
                                        <div className={`text-3xl ${isCurrentLeague ? '' : 'opacity-70'}`}>{LEAGUE_ICONS[league]}</div>
                                        <p className="mt-2 text-sm font-black">{league}</p>
                                        <p className={`mt-1 text-[10px] font-black uppercase tracking-[0.18em] ${isCurrentLeague ? 'text-white/70' : 'text-slate-400'}`}>
                                            {getLeagueStepStatus(index, currentLeague)}
                                        </p>
                                    </div>

                                    {index < LEAGUE_ORDER.length - 1 && (
                                        <ChevronRight className="h-4 w-4 text-slate-300" />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className={`relative mb-5 overflow-hidden rounded-[2rem] bg-gradient-to-br ${LEAGUE_COLORS[currentLeague] || LEAGUE_COLORS.Bronze} p-5 text-white shadow-2xl shadow-indigo-500/15`}>
                <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-white/10 blur-3xl" />
                <div className="absolute -bottom-10 -left-10 h-24 w-24 rounded-full bg-black/10 blur-2xl" />

                <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div className="flex items-start gap-4">
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.5rem] bg-white/15 text-4xl shadow-lg backdrop-blur-sm">
                            {LEAGUE_ICONS[currentLeague] || LEAGUE_ICONS.Bronze}
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/75">Classificacao semanal</p>
                            <h1 className="mt-1 text-[2rem] font-black leading-none tracking-tight md:text-[2.5rem]">
                                Liga {currentLeague}
                            </h1>
                            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm font-bold text-white/90">
                                <span className="inline-flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4" />
                                    Termina em <span className="underline decoration-2 underline-offset-4">{timeLeft}</span>
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <div className="rounded-2xl border border-white/20 bg-white/15 px-3 py-2 backdrop-blur-sm">
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/70">Posicao</p>
                            <p className="mt-1 text-2xl font-black leading-none">#{userRank || '--'}</p>
                        </div>
                        <div className="rounded-2xl border border-white/20 bg-white/15 px-3 py-2 backdrop-blur-sm">
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/70">XP</p>
                            <p className="mt-1 text-2xl font-black leading-none">{userRank > 0 ? userWeeklyXp : '--'}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="overflow-hidden rounded-[2.4rem] border-2 border-slate-100 bg-white shadow-xl">
                {renderLeaderboard()}
            </div>

            {profile?.role === 'admin' && adminRooms.length > 0 && (
                <div className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Admin</p>
                            <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">Todas as salas desta semana</h3>
                        </div>
                        <div className="rounded-2xl bg-slate-100 px-3 py-2 text-right">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Ativas</p>
                            <p className="mt-1 text-sm font-black text-slate-900">{adminRooms.length} salas</p>
                        </div>
                    </div>

                    <div className="mt-6 grid gap-4 md:grid-cols-2">
                        {adminRooms.map((room) => {
                            const leader = room.leaderboard[0];
                            return (
                                <div key={room.id} className="rounded-[1.8rem] border border-slate-200 bg-slate-50 p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                                                Liga {room.league_name}
                                            </p>
                                            <h4 className="mt-1 text-lg font-black text-slate-900">
                                                Sala {room.room_number}
                                            </h4>
                                        </div>
                                        <div className="rounded-2xl bg-white px-3 py-2 text-right shadow-sm">
                                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Vagas</p>
                                            <p className="mt-1 text-sm font-black text-slate-900">
                                                {room.participant_count}/{room.max_participants}
                                            </p>
                                        </div>
                                    </div>

                                    {leader ? (
                                        <div className="mt-4 rounded-[1.5rem] bg-white p-4 shadow-sm">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-xl">
                                                    <Crown className="h-6 w-6 text-amber-500" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate font-black text-slate-900">{leader.profiles?.full_name || 'Aluno MINSA'}</p>
                                                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                                                        Lider atual
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-lg font-black text-slate-900">{leader.xp_earned}</p>
                                                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">XP</p>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="mt-4 rounded-[1.5rem] bg-white p-4 text-sm font-medium text-slate-500 shadow-sm">
                                            Nenhum participante nesta sala ainda.
                                        </p>
                                    )}

                                    {room.leaderboard.length > 1 && (
                                        <div className="mt-4 space-y-2">
                                            {room.leaderboard.slice(0, 3).map((entry, index) => (
                                                <div key={entry.user_id} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm">
                                                    <div className="flex items-center gap-3">
                                                        <span className="w-6 text-sm font-black text-slate-400">#{index + 1}</span>
                                                        <p className="truncate text-sm font-bold text-slate-800">
                                                            {entry.profiles?.full_name || 'Aluno MINSA'}
                                                        </p>
                                                    </div>
                                                    <span className="text-sm font-black text-slate-900">{entry.xp_earned} XP</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {pendingResult && (
                <div className="mt-8 rounded-[2rem] border border-amber-200 bg-amber-50 p-5 text-amber-900">
                    <p className="font-black">Tens um resultado semanal por confirmar.</p>
                    <p className="mt-2 text-sm font-medium">O resumo continua disponivel ate tocares em continuar.</p>
                </div>
            )}
        </div>
    );
}
