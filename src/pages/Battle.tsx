import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Loader2, Swords, Trophy, Users, Zap, ShieldAlert, Check, X as CloseIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useAppStore } from '../store/useAppStore';

export default function Battle() {
    const { profile } = useAuthStore();
    const { areas } = useAppStore();
    const navigate = useNavigate();
    const [opponents, setOpponents] = useState<any[]>([]);
    const [matches, setMatches] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const isElite = profile?.role === 'elite' || profile?.role === 'admin';

    const fetchMatches = async () => {
        if (!profile?.id) return;
        const { data } = await supabase
            .from('battle_matches')
            .select('*, challenger:challenger_id(full_name), opponent:opponent_id(full_name)')
            .or(`challenger_id.eq.${profile.id},opponent_id.eq.${profile.id}`)
            .order('created_at', { ascending: false });

        if (data) setMatches(data);
    };

    useEffect(() => {
        if (!isElite || !profile?.selected_area_id) return;

        const fetchOpponents = async () => {
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('id, full_name, total_xp, role')
                    .eq('selected_area_id', profile.selected_area_id)
                    .neq('id', profile.id)
                    .order('total_xp', { ascending: false })
                    .limit(10);

                if (!error && data) {
                    setOpponents(data);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchOpponents();
        fetchMatches();

        // Realtime subscription
        const channel = supabase
            .channel('battle_updates')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'battle_matches'
            }, () => {
                fetchMatches();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [isElite, profile?.id, profile?.selected_area_id]);

    const handleChallenge = async (opponentId: string) => {
        if (!profile?.id || !profile.selected_area_id) return;

        try {
            const { error } = await supabase.from('battle_matches').insert({
                challenger_id: profile.id,
                opponent_id: opponentId,
                area_id: profile.selected_area_id,
                status: 'pending'
            });

            if (error) throw error;
            alert('Desafio enviado com sucesso!');
        } catch (err) {
            console.error('Erro ao desafiar:', err);
            alert('Não foi possível criar o desafio. Verifique a sua ligação e tente novamente.');
        }
    };

    const handleAccept = async (matchId: string) => {
        const { error } = await supabase
            .from('battle_matches')
            .update({ status: 'active' })
            .eq('id', matchId);

        if (!error) {
            navigate(`/battle/${matchId}`);
        }
    };

    const handleReject = async (matchId: string) => {
        await supabase
            .from('battle_matches')
            .update({ status: 'rejected' })
            .eq('id', matchId);
    };

    if (!isElite) {
        return (
            <div className="mx-auto max-w-4xl space-y-6">
                <div className="overflow-hidden mb-12 rounded-[2.5rem] border border-purple-200 bg-[radial-gradient(ellipse_at_top,#2e026d,#0f172a)] p-8 text-center text-white shadow-2xl">
                    <div className="mx-auto flex h-24 w-24 mb-6 items-center justify-center rounded-full bg-purple-500/20 shadow-[0_0_60px_-10px_rgba(168,85,247,0.8)]">
                        <Swords className="h-12 w-12 text-purple-300" />
                    </div>
                    <h1 className="mt-6 text-4xl font-black tracking-tight text-white drop-shadow-lg">
                        Modo Batalha XP Plus
                    </h1>
                    <p className="mt-4 mx-auto max-w-xl text-lg text-purple-100">
                        A funcionalidade definitiva para estudantes super comprometidos. Desafie outros candidatos,
                        prove o que sabe e ganhe o dobro do XP se vencer. Apenas no Plano Elite.
                    </p>
                    <div className="mt-8 mb-4">
                        <Link
                            to="/premium"
                            className="inline-flex rounded-full bg-gradient-to-r from-purple-400 to-fuchsia-400 px-8 py-4 text-base font-black uppercase tracking-wider text-slate-950 transition hover:scale-105 hover:shadow-[0_0_30px_-5px_rgba(192,132,252,0.6)]"
                        >
                            Fazer Upgrade para Elite
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-5xl space-y-6 md:space-y-8">
            <section className="overflow-hidden rounded-[2.5rem] border border-purple-200 bg-[radial-gradient(ellipse_at_top_right,#4c1d95,#0f172a)] p-6 text-white shadow-2xl md:p-10">
                <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
                    <div className="max-w-xl">
                        <div className="inline-flex items-center gap-2 rounded-full bg-purple-500/30 px-3 py-1 text-xs font-bold uppercase tracking-widest text-purple-200 backdrop-blur-md">
                            <Zap className="h-4 w-4" />
                            Elite Exclusivo
                        </div>
                        <h1 className="mt-5 text-4xl font-black leading-tight text-white drop-shadow-xl md:text-5xl">
                            Modo Batalha
                        </h1>
                        <p className="mt-4 text-lg text-purple-100">
                            Escolha o seu adversário na sua Área. 10 perguntas. Quem acertar mais e for mais rápido ganha o XP da partida.
                        </p>
                    </div>

                    <div className="flex flex-col gap-4 rounded-3xl bg-white/10 p-6 backdrop-blur-md border border-white/20">
                        <p className="text-xs font-bold uppercase tracking-widest text-purple-200">A sua energia Batalha</p>
                        <div className="flex items-center gap-3">
                            <ShieldAlert className="h-8 w-8 text-fuchsia-400" />
                            <div className="text-3xl font-black text-white">5 / 5</div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
                {/* Matches Feed */}
                <div className="rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-xl md:p-8">
                    <h2 className="text-xl font-black text-slate-900 flex items-center gap-3 border-b border-slate-100 pb-5 mb-6">
                        <Zap className="h-6 w-6 text-amber-500" />
                        Atividades Recentes
                    </h2>

                    <div className="space-y-4">
                        {matches.length === 0 ? (
                            <p className="py-8 text-center text-slate-500 text-sm italic">Nenhuma batalha ativa ou pendente.</p>
                        ) : (
                            matches.map(m => {
                                const isOpponent = m.opponent_id === profile?.id;
                                const otherName = isOpponent ? m.challenger?.full_name : m.opponent?.full_name;
                                return (
                                    <div key={m.id} className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-bold text-slate-800">
                                                {m.status === 'pending' ? (isOpponent ? `Desafio de ${otherName}` : `Aguardando ${otherName}`) : `Batalha contra ${otherName}`}
                                            </p>
                                            <p className="text-[10px] uppercase font-black tracking-widest text-slate-400 mt-1">{m.status}</p>
                                        </div>
                                        {m.status === 'pending' && isOpponent && (
                                            <div className="flex gap-2">
                                                <button onClick={() => handleAccept(m.id)} className="p-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors">
                                                    <Check className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleReject(m.id)} className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">
                                                    <CloseIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Opponents List */}
                <div className="rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-xl md:p-8">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-5 mb-6">
                        <h2 className="text-xl font-black text-slate-900 flex items-center gap-3">
                            <Users className="h-6 w-6 text-purple-600" />
                            Adversários na Área
                        </h2>
                    </div>

                    <div>
                        {loading ? (
                            <div className="py-12 flex justify-center">
                                <Loader2 className="animate-spin h-8 w-8 text-purple-500" />
                            </div>
                        ) : opponents.length === 0 ? (
                            <p className="py-8 text-center text-slate-500">
                                Não existem oponentes ativos no momento para a sua área.
                            </p>
                        ) : (
                            <div className="space-y-4">
                                {opponents.map((opp) => (
                                    <div key={opp.id} className="group flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 p-4 transition-all hover:border-purple-200 hover:bg-purple-50">
                                        <div className="flex items-center gap-4">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 font-black text-purple-700">
                                                {(opp.full_name || 'U').charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-800">{opp.full_name}</p>
                                                <p className="text-[10px] text-slate-500 flex items-center gap-1 font-bold">
                                                    <Trophy className="h-3 w-3 text-amber-500" /> {opp.total_xp || 0} XP
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleChallenge(opp.id)}
                                            className="rounded-lg bg-slate-900 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white hover:bg-purple-600 transition-colors"
                                        >
                                            Desafiar
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
}
