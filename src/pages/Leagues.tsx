import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, TrendingUp, Trophy, Flame, ChevronRight, Info } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { motion } from 'motion/react';
import { useAppStore } from '../store/useAppStore';

const LEAGUE_COLORS: Record<string, string> = {
    'Bronze': 'from-amber-400 to-orange-600',
    'Prata': 'from-slate-300 to-slate-500',
    'Ouro': 'from-yellow-300 to-yellow-600',
};

const LEAGUE_ICONS: Record<string, string> = {
    'Bronze': '🥉',
    'Prata': '🥈',
    'Ouro': '🥇',
};

export default function Leagues() {
    const navigate = useNavigate();
    const { profile } = useAuthStore();
    const { areas, fetchAreas } = useAppStore();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<any[]>([]);
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
        fetchAreas();

        const fetchLeagueData = async () => {
            if (!profile?.id) return;

            // Calcular o início da semana (Segunda-feira) de forma robusta
            const date = new Date();
            const day = date.getDay();
            const diff = date.getDate() - day + (day === 0 ? -6 : 1);
            const monday = new Date(date.setDate(diff)).toISOString().split('T')[0];

            try {
                const { data, error } = await supabase
                    .from('weekly_league_stats')
                    .select('user_id, xp_earned, profiles(full_name, avatar_style, avatar_url, selected_area_id)')
                    .eq('league_name', profile.current_league || 'Bronze')
                    .eq('week_start_date', monday)
                    .order('xp_earned', { ascending: false })
                    .limit(30);

                if (error) throw error;
                setStats(data || []);
            } catch (err) {
                console.error('[Leagues] Erro ao carregar dados:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchLeagueData();

        // Calculate time left until Sunday midnight
        const updateTimer = () => {
            const now = new Date();
            const nextSunday = new Date();
            nextSunday.setDate(now.getDate() + (7 - now.getDay()) % 7);
            nextSunday.setHours(23, 59, 59, 999);

            const diff = nextSunday.getTime() - now.getTime();
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
            const mins = Math.floor((diff / (1000 * 60)) % 60);

            setTimeLeft(`${days}d ${hours}h ${mins}m`);
        };

        updateTimer();
        const interval = setInterval(updateTimer, 60000);
        return () => clearInterval(interval);
    }, [profile]);

    const areaNameById = useMemo(() => {
        const map = new Map<string, string>();
        areas.forEach((a: any) => map.set(a.id, a.name));
        return (id?: string | null) => (id ? map.get(id) || 'Área não definida' : 'Área não definida');
    }, [areas]);

    const userRank = stats.findIndex(s => s.user_id === profile?.id) + 1;
    const currentLeague = profile?.current_league || 'Bronze';

    return (
        <div className="max-w-3xl mx-auto pb-24">
            {/* League Header */}
            <div className={`relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br ${LEAGUE_COLORS[currentLeague]} p-8 text-white shadow-2xl shadow-indigo-500/20 mb-8`}>
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-6">
                    <div className="text-6xl filter drop-shadow-lg animate-bounce duration-[2000ms]">
                        {LEAGUE_ICONS[currentLeague]}
                    </div>
                    <div className="text-center md:text-left">
                        <h1 className="text-4xl font-black tracking-tight mb-2">Liga {currentLeague}</h1>
                        <p className="font-bold opacity-90 flex items-center justify-center md:justify-start gap-2">
                            <TrendingUp className="w-5 h-5" />
                            Termina em: <span className="underline decoration-2 underline-offset-4">{timeLeft}</span>
                        </p>
                    </div>
                    <div className="md:ml-auto bg-white/20 backdrop-blur-md rounded-3xl p-4 border border-white/30 text-center">
                        <p className="text-xs font-black uppercase tracking-widest opacity-80">Sua Posição</p>
                        <p className="text-4xl font-black">#{userRank || '--'}</p>
                    </div>
                </div>
                {/* Decorative blobs */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full blur-2xl -ml-24 -mb-24"></div>
            </div>

            {/* Promotion/Relegation Zone Legend */}
            <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-emerald-50 border-2 border-emerald-100 p-4 rounded-2xl flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                    <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Zona de Promoção (Top 10)</p>
                </div>
                <div className="bg-red-50 border-2 border-red-100 p-4 rounded-2xl flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]"></div>
                    <p className="text-xs font-bold text-red-800 uppercase tracking-wider">Zona de Rebaixamento (Last 5)</p>
                </div>
            </div>

            {/* Leaderboard */}
            <div className="bg-white rounded-[2.5rem] border-2 border-slate-100 shadow-xl overflow-hidden">
                {loading ? (
                    <div className="p-20 flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        <p className="font-bold text-slate-400">Carregando a liga...</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-50">
                        {stats.map((entry, index) => {
                            const isUser = entry.user_id === profile?.id;
                            const isPromoted = index < 10;
                            const isRelegated = index >= stats.length - 5 && stats.length > 15;

                            return (
                                <motion.div
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    key={entry.user_id}
                                    onClick={() => navigate(`/profile/${entry.user_id}`)}
                                    className={`flex items-center gap-4 p-5 transition-colors cursor-pointer ${isUser ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}`}
                                >
                                    <div className="w-8 flex justify-center text-lg font-black text-slate-400">
                                        {index + 1 === 1 ? '🥇' : index + 1 === 2 ? '🥈' : index + 1 === 3 ? '🥉' : index + 1}
                                    </div>
                                    <div className="relative">
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-white text-lg shadow-md overflow-hidden ${isUser ? 'bg-indigo-600' : 'bg-slate-200 text-slate-500'}`}>
                                            {entry.profiles?.avatar_url ? (
                                                <img src={entry.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                entry.profiles?.full_name?.charAt(0) || '?'
                                            )}
                                        </div>
                                        {(isPromoted || isRelegated) && (
                                            <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${isPromoted ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <p className={`font-bold ${isUser ? 'text-indigo-600' : 'text-slate-800'}`}>
                                            {entry.profiles?.full_name} {isUser && '(Você)'}
                                        </p>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <div className="w-2 h-2 rounded-full bg-slate-200"></div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                {areaNameById(entry.profiles?.selected_area_id)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-black text-slate-900 leading-none">{entry.xp_earned}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">XP SEMANAL</p>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Rules Info */}
            <div className="mt-8 bg-slate-900 rounded-[2rem] p-6 text-white text-sm">
                <div className="flex items-center gap-3 mb-4">
                    <Info className="w-6 h-6 text-indigo-400" />
                    <h3 className="text-lg font-bold">Como funcionam as Ligas?</h3>
                </div>
                <ul className="space-y-3 opacity-80 font-medium">
                    <li className="flex gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0"></div>
                        Ganhe XP estudando todos os dias para subir no ranking.
                    </li>
                    <li className="flex gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0"></div>
                        O **Top 10** da liga atual sobe para a próxima divisão no domingo.
                    </li>
                    <li className="flex gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0"></div>
                        Os **últimos 5** correm risco de rebaixamento para a liga anterior.
                    </li>
                    <li className="flex gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0"></div>
                        Ligas superiores dão recompensas exclusivas e emblemas no perfil!
                    </li>
                </ul>
            </div>
        </div>
    );
}
