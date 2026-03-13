import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../store/useAppStore';
import { Users, Search, RefreshCw, Loader2, Monitor } from 'lucide-react';

export default function AdminUsers() {
    const { areas } = useAppStore();
    const [userList, setUserList] = useState<any[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [userSearchQuery, setUserSearchQuery] = useState('');

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoadingUsers(true);
        const { data, error } = await supabase
            .from('profiles')
            .select('*, areas(name), last_active, total_xp')
            .order('last_active', { ascending: false, nullsFirst: false });

        if (!error && data) {
            setUserList(data);
        }
        setLoadingUsers(false);
    };

    const handleUpdateUserRole = async (userId: string, role: string) => {
        const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
        if (error) alert('Erro ao atualizar cargo.');
        else fetchUsers();
    };

    const handleUpdateUserArea = async (userId: string, areaId: string) => {
        const { error } = await supabase.from('profiles').update({ selected_area_id: areaId }).eq('id', userId);
        if (error) alert('Erro ao atualizar área.');
        else fetchUsers();
    };

    const filteredUsers = userList.filter(u => u.full_name?.toLowerCase().includes(userSearchQuery.toLowerCase()));

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-white rounded-[2.2rem] border border-slate-200 shadow-xl shadow-slate-200/40 overflow-hidden">
                <div className="p-8 border-b border-slate-100 flex flex-col lg:flex-row justify-between items-center gap-6 bg-[radial-gradient(circle_at_top_right,#f8fafc,transparent)]">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Membros e Acessos</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{userList.length} utilizadores</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 w-full lg:w-auto">
                        <div className="relative flex-1 lg:w-80">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Procurar por nome..."
                                value={userSearchQuery}
                                onChange={(e) => setUserSearchQuery(e.target.value)}
                                className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-slate-200 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50/50 transition-all font-bold text-slate-700 text-sm shadow-sm"
                            />
                        </div>
                        <button
                            onClick={fetchUsers}
                            disabled={loadingUsers}
                            className="flex items-center justify-center h-[52px] w-[52px] lg:w-auto lg:px-6 rounded-2xl bg-slate-900 text-white font-black uppercase tracking-widest text-[10px] hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50"
                        >
                            {loadingUsers ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5 lg:mr-2" />}
                            <span className="hidden lg:inline">Atualizar</span>
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto p-4">
                    <table className="w-full text-left border-separate border-spacing-y-2">
                        <thead className="bg-slate-50/50 text-slate-400 text-[9px] font-black uppercase tracking-[0.25em]">
                            <tr>
                                <th className="px-6 py-4 rounded-l-2xl">Membro</th>
                                <th className="px-6 py-4">Papel / Plano</th>
                                <th className="px-6 py-4">Área</th>
                                <th className="px-6 py-4">Número</th>
                                <th className="px-6 py-4">Estado</th>
                                <th className="px-6 py-4 text-right rounded-r-2xl">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-transparent">
                            {loadingUsers ? (
                                <tr><td colSpan={6} className="px-6 py-32 text-center"><Loader2 className="h-10 w-10 animate-spin mx-auto text-emerald-500 mb-2" /><p className="text-xs font-bold text-slate-400 uppercase tracking-widest">A carregar...</p></td></tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr><td colSpan={6} className="px-6 py-32 text-center text-slate-400 font-bold uppercase tracking-widest italic opacity-40">Nenhum rastro encontrado...</td></tr>
                            ) : (
                                filteredUsers.map((u) => (
                                    <tr key={u.id} className="bg-slate-50/20 hover:bg-white transition-all group hover:shadow-xl hover:shadow-slate-200/50">
                                        <td className="px-6 py-5 rounded-l-2xl border border-transparent border-l-slate-200 group-hover:border-slate-100">
                                            <div className="flex items-center gap-4">
                                                <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-slate-200 to-slate-100 flex items-center justify-center text-slate-500 font-black text-xs uppercase shadow-sm">
                                                    {u.full_name?.substring(0, 2)}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-slate-900">{u.full_name}</p>
                                                    <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest">{u.student_number || u.id.substring(0, 8)}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <select
                                                value={u.role}
                                                onChange={(e) => handleUpdateUserRole(u.id, e.target.value)}
                                                className={`text-[9px] font-black uppercase tracking-wider px-3 py-1.5 rounded-xl border transition-all outline-none
                                                ${u.role === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                                        u.role === 'premium' || u.role === 'elite' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                            'bg-white text-slate-600 border-slate-200'}`}
                                            >
                                                <option value="free">Gratuito</option>
                                                <option value="basic">Basic (Estudante)</option>
                                                <option value="premium">Premium (Assinante)</option>
                                                <option value="elite">Elite (MAX)</option>
                                                <option value="admin">Administrador</option>
                                            </select>
                                        </td>
                                        <td className="px-6 py-5">
                                            <p className="text-xs font-bold text-slate-700">{u.areas?.name || '---'}</p>
                                        </td>
                                        <td className="px-6 py-5">
                                            <p className="text-xs font-bold text-slate-700">
                                                {u.phone || 'Sem número'}
                                            </p>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-2">
                                                <div className={`h-2 w-2 rounded-full ${u.last_active && (Date.now() - new Date(u.last_active).getTime() < 10 * 60 * 1000) ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                                                <span className="text-[10px] font-bold text-slate-500">
                                                    {u.last_active ? new Date(u.last_active).toLocaleDateString() : 'N/A'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-right rounded-r-2xl border border-transparent border-r-slate-200 group-hover:border-slate-100">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={async () => {
                                                        try {
                                                            const { data } = await supabase.from('activity_logs').select('*').eq('user_id', u.id).order('activity_date', { ascending: false }).limit(5);
                                                            const msg = data?.map((l: any) => `[${new Date(l.activity_date).toLocaleTimeString()}] ${l.activity_type}`).join('\n');
                                                            alert(`Pegadas Recentes:\n${msg || 'Nenhuma pegada.'}`);
                                                        } catch (e) { alert('Erro.'); }
                                                    }}
                                                    className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-800 hover:text-white transition-all"
                                                >
                                                    <Monitor className="w-4 h-4" />
                                                </button>
                                                <select
                                                    value={u.selected_area_id || ''}
                                                    onChange={(e) => handleUpdateUserArea(u.id, e.target.value)}
                                                    className="text-[10px] font-black uppercase tracking-tight border border-slate-200 rounded-xl bg-white px-2 py-1.5 focus:border-emerald-500 outline-none"
                                                >
                                                    <option value="">Zona...</option>
                                                    {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                                </select>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
