import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Monitor, Clock, Database } from 'lucide-react';

export default function AdminMonitor() {
    const [recentAttempts, setRecentAttempts] = useState<any[]>([]);
    const [recentActivities, setRecentActivities] = useState<any[]>([]);
    const [loadingMonitor, setLoadingMonitor] = useState(false);

    useEffect(() => {
        fetchMonitorData();
        const interval = setInterval(fetchMonitorData, 10000); // 10s auto-refresh
        return () => clearInterval(interval);
    }, []);

    const fetchMonitorData = async () => {
        setLoadingMonitor(true);
        try {
            const { data: attData } = await supabase
                .from('simulation_attempts')
                .select('*, areas(name), profiles(full_name)')
                .order('started_at', { ascending: false })
                .limit(20);

            if (attData) setRecentAttempts(attData);

            const { data: actData } = await supabase
                .from('activity_logs')
                .select('*, profiles(full_name)')
                .order('activity_date', { ascending: false })
                .limit(40);

            if (actData) setRecentActivities(actData);
        } catch (error) {
            console.error('Error fetching monitor data:', error);
        } finally {
            setLoadingMonitor(false);
        }
    };

    const getActivityLabel = (type: string) => {
        switch (type) {
            case 'started_simulation': return 'Iniciou Simulação';
            case 'completed_simulation': return 'Terminou Simulação';
            case 'started_training': return 'Iniciou Treino';
            case 'completed_training': return 'Terminou Treino';
            case 'xp_earned': return 'Ganhou XP';
            case 'login': return 'Login Efectuado';
            case 'signup': return 'Novo Registo';
            default: return type.replace(/_/g, ' ');
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Active Simulations Log */}
                <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[600px]">
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-[linear-gradient(135deg,#f0f9ff_0%,#e0f2fe_100%)]">
                        <div className="flex items-center gap-3">
                            <div className="p-3 rounded-2xl bg-blue-100 text-blue-700 shadow-sm">
                                <Monitor className="h-6 w-6" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-900 leading-tight">Painel de Provas</h2>
                                <p className="text-[10px] text-blue-600/70 font-black uppercase tracking-widest mt-1">Live Feed</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-5 space-y-3 custom-scrollbar bg-slate-50/50">
                        {recentAttempts.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center opacity-40">
                                <Database className="h-10 w-10 mb-4 text-slate-300" />
                                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Sem actividade recente</p>
                            </div>
                        ) : (
                            recentAttempts.map((attempt) => (
                                <div key={attempt.id} className="p-4 rounded-[1.5rem] border border-slate-200 bg-white hover:border-blue-300 transition-all hover:shadow-lg shadow-slate-100 border-l-[6px] border-l-blue-500 group">
                                    <div className="flex justify-between items-start">
                                        <span className="text-sm font-black text-slate-900 truncate pr-2 uppercase tracking-tight group-hover:text-blue-700 transition-colors">
                                            {attempt.profiles?.full_name || 'Usuário Desconhecido'}
                                        </span>
                                        <span className="text-[10px] font-black text-slate-400 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 whitespace-nowrap align-top float-right">
                                            {new Date(attempt.started_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-2 font-bold uppercase tracking-widest">{attempt.areas?.name}</p>

                                    <div className="mt-4 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[10px] px-3 py-1.5 rounded-xl font-black uppercase tracking-widest ${attempt.is_completed ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-blue-600 text-white shadow-md shadow-blue-500/30 animate-pulse'}`}>
                                                {attempt.is_completed ? 'Concluído' : 'A Realizar Prova'}
                                            </span>
                                        </div>
                                        {attempt.is_completed && (
                                            <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100">
                                                <div className="h-1.5 w-12 bg-emerald-200 rounded-full overflow-hidden hidden sm:block">
                                                    <div className="h-full bg-emerald-500" style={{ width: `${attempt.score}%` }} />
                                                </div>
                                                <span className="text-[11px] font-black text-emerald-700">{attempt.score}%</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* General Activity Logs */}
                <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[600px]">
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-[linear-gradient(135deg,#f0fdf4_0%,#dcfce7_100%)]">
                        <div className="flex items-center gap-3">
                            <div className="p-3 rounded-2xl bg-emerald-100 text-emerald-700 shadow-sm">
                                <ActivityLogIcon className="h-6 w-6" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-900 leading-tight">Log de Ações Globais</h2>
                                <p className="text-[10px] text-emerald-600/70 font-black uppercase tracking-widest mt-1">Audit Trail</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar bg-slate-50/50">
                        {recentActivities.map((log, idx) => {
                            const metadata = log.activity_metadata || {};
                            const type = log.activity_type;

                            return (
                                <div key={idx} className="flex flex-col p-4 rounded-[1.5rem] bg-white border border-slate-200 hover:border-slate-300 transition-all shadow-sm">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex gap-3">
                                            <div className={`mt-1 h-3 w-3 shrink-0 rounded-full border-2 border-white shadow-[0_0_0_2px_rgba(0,0,0,0.05)] ${type.includes('simulation') ? 'bg-blue-500' : type.includes('training') ? 'bg-amber-400' : type.includes('xp') ? 'bg-purple-500' : 'bg-emerald-500'}`} />
                                            <div>
                                                <span className="text-xs font-black text-slate-900 uppercase tracking-tight">{log.profiles?.full_name || 'Sistema'}</span>
                                                <div className="mt-1">
                                                    <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-widest ${type.includes('simulation') ? 'bg-blue-50 text-blue-700' : type.includes('training') ? 'bg-amber-50 text-amber-700' : type.includes('xp') ? 'bg-purple-50 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>
                                                        {getActivityLabel(type)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-[10px] font-black text-slate-400">{new Date(log.created_at || log.activity_date).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</p>
                                        </div>
                                    </div>

                                    {(metadata.score !== undefined || metadata.topic_name || metadata.xp) && (
                                        <div className="mt-3 ml-[1.625rem] border-l-2 border-slate-100 pl-4 py-1 flex flex-wrap gap-2">
                                            {metadata.xp && (
                                                <span className="text-[10px] font-black text-purple-600 bg-purple-50 px-2 py-1 rounded-lg">
                                                    +{metadata.xp} XP
                                                </span>
                                            )}
                                            {metadata.topic_name && (
                                                <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-lg max-w-[150px] truncate">
                                                    {metadata.topic_name}
                                                </span>
                                            )}
                                            {metadata.score !== undefined && (
                                                <span className="text-[10px] font-black text-amber-700 bg-amber-50 px-2 py-1 rounded-lg">
                                                    Score: {metadata.score}%
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

function ActivityLogIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
    )
}
