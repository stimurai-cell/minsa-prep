import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { Users, Database, Zap, BellRing, XCircle, Monitor } from 'lucide-react';

export default function AdminDashboard() {
    const { profile } = useAuthStore();
    const [stats, setStats] = useState({ users: 0, questions: 0, premium: 0, pendingPayments: 0 });
    const [dbError, setDbError] = useState<string | null>(null);
    const [onlineUsers, setOnlineUsers] = useState<any[]>([]);

    useEffect(() => {
        fetchStats();
        fetchOnlineUsers();
        const interval = setInterval(() => {
            fetchStats();
            fetchOnlineUsers();
        }, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchStats = async () => {
        try {
            setDbError(null);
            const { count: usersCount, error: usersErr } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
            const { count: qCount } = await supabase.from('questions').select('*', { count: 'exact', head: true });
            const { count: premCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'premium');
            const { count: pendingPaymentsCount } = await supabase.from('payment_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending');

            if (usersErr) setDbError(usersErr.message);

            setStats({
                users: usersCount || 0,
                questions: qCount || 0,
                premium: premCount || 0,
                pendingPayments: pendingPaymentsCount || 0,
            });
        } catch (err) {
            console.error('Error fetching stats', err);
        }
    };

    const fetchOnlineUsers = async () => {
        try {
            const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
            const { data } = await supabase
                .from('profiles')
                .select('id, full_name, student_number, last_active')
                .gte('last_active', fiveMinsAgo)
                .order('last_active', { ascending: false });
            setOnlineUsers(data || []);
        } catch (err) {
            console.error('Error fetching online users', err);
        }
    };

    return (
        <div className="space-y-6">
            <div className="rounded-[2rem] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f2f7ff_40%,#f4fbf7_100%)] p-6 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.35)]">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Visão Geral</p>
                <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-900 md:text-4xl">Bem-vindo, {profile?.full_name?.split(' ')[0]}</h1>
                <p className="text-gray-500 mt-2">Veja como a plataforma está a comportar-se agora.</p>
            </div>

            {dbError && (
                <div className="rounded-[1.8rem] border border-red-200 bg-red-50 p-6 shadow-sm">
                    <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-600">
                            <XCircle className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-red-900">Erro de Banco de Dados</h3>
                            <p className="mt-1 text-sm text-red-700">{dbError}</p>
                        </div>
                    </div>
                </div>
            )}

            {stats.pendingPayments > 0 && (
                <div className="rounded-[1.8rem] border border-amber-200 bg-amber-50 p-5">
                    <div className="flex items-start gap-3">
                        <BellRing className="mt-1 h-5 w-5 text-amber-700" />
                        <div>
                            <p className="text-lg font-black text-slate-900">
                                {stats.pendingPayments} Pagamento(s) Pendente(s)
                            </p>
                            <p className="mt-1 text-sm text-slate-700">Acesse a aba Finanças para rever.</p>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="bg-white p-5 rounded-[1.8rem] shadow-sm border border-slate-200 flex items-center gap-4 hover:shadow-md transition-all">
                    <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
                        <Users className="w-7 h-7" />
                    </div>
                    <div>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Total Usuários</p>
                        <p className="text-2xl font-black text-slate-900">{stats.users}</p>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-[1.8rem] shadow-sm border border-slate-200 flex items-center gap-4 hover:shadow-md transition-all">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                        <Database className="w-7 h-7" />
                    </div>
                    <div>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Total Questões</p>
                        <p className="text-2xl font-black text-slate-900">{stats.questions}</p>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-[1.8rem] shadow-sm border border-slate-200 flex items-center gap-4 hover:shadow-md transition-all">
                    <div className="w-14 h-14 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600">
                        <Zap className="w-7 h-7" />
                    </div>
                    <div>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Assinantes Premium</p>
                        <p className="text-2xl font-black text-slate-900">{stats.premium}</p>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-[1.8rem] shadow-sm border border-slate-200 flex items-center gap-4 hover:shadow-md transition-all">
                    <div className="w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600">
                        <Monitor className="w-7 h-7" />
                    </div>
                    <div>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Online Agora (5m)</p>
                        <p className="text-2xl font-black text-slate-900">{onlineUsers.length}</p>
                    </div>
                </div>
            </div>

            {onlineUsers.length > 0 && (
                <div className="bg-white rounded-[2rem] border border-slate-200 p-6 shadow-sm">
                    <h3 className="font-black text-slate-900 mb-4">Membros Ativos (Live)</h3>
                    <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                        {onlineUsers.map(u => (
                            <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50">
                                <div className="relative">
                                    <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-black">
                                        {u.full_name?.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white animate-pulse" />
                                </div>
                                <div className="min-w-0">
                                    <p className="font-bold text-sm text-slate-900 truncate">{u.full_name}</p>
                                    <p className="text-[10px] text-slate-500">{new Date(u.last_active).toLocaleTimeString()}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
