import { useState, useEffect } from 'react';
import { Swords, Trophy, Users, Zap, ShieldAlert } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useAppStore } from '../store/useAppStore';
import { Link } from 'react-router-dom';

export default function Battle() {
    const { profile } = useAuthStore();
    const { areas } = useAppStore();
    const [opponents, setOpponents] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const isElite = profile?.role === 'elite' || profile?.role === 'admin';

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
    }, [isElite, profile?.id, profile?.selected_area_id]);

    const handleChallenge = (name: string) => {
        alert(`O desafio para ${name} foi enviado! Fique atento às notificações para começar a Batalha XP quando o oponente aceitar.`);
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

            <section className="rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-xl md:p-8">
                <div className="flex items-center justify-between border-b border-slate-100 pb-5">
                    <h2 className="text-xl font-black text-slate-900 flex items-center gap-3">
                        <Users className="h-6 w-6 text-purple-600" />
                        Adversários de Elite
                    </h2>
                </div>

                <div className="mt-6">
                    {loading ? (
                        <div className="py-12 flex justify-center">
                            <div className="animate-spin h-8 w-8 border-4 border-purple-500 rounded-full border-t-transparent"></div>
                        </div>
                    ) : opponents.length === 0 ? (
                        <p className="py-8 text-center text-slate-500">
                            Não existem oponentes ativos no momento para a sua área.
                        </p>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
                            {opponents.map((opp) => (
                                <div key={opp.id} className="group relative flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 p-4 transition-all hover:border-purple-200 hover:bg-purple-50 hover:shadow-lg">
                                    <div className="flex items-center gap-4">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 font-black text-purple-700 shadow-inner">
                                            {(opp.full_name || 'U').charAt(0)}
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-900">{opp.full_name}</p>
                                            <p className="text-xs text-slate-500 flex items-center gap-1">
                                                <Trophy className="h-3 w-3 text-emerald-500" /> {opp.total_xp || 0} XP
                                            </p>
                                        </div>
                                    </div>
                                    <div>
                                        <button
                                            onClick={() => handleChallenge(opp.full_name)}
                                            className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-purple-600 hover:shadow-[0_0_15px_-3px_rgba(168,85,247,0.5)]"
                                        >
                                            Desafiar
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
