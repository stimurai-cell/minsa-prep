import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { MessageCircle, RefreshCw, Loader2 } from 'lucide-react';

export default function AdminSupport() {
    const [supportMessages, setSupportMessages] = useState<any[]>([]);
    const [loadingSupport, setLoadingSupport] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
    const [adminResponse, setAdminResponse] = useState('');

    useEffect(() => {
        fetchSupportMessages();
    }, []);

    const fetchSupportMessages = async () => {
        setLoadingSupport(true);
        const { data, error } = await supabase
            .from('support_messages')
            .select('*, profiles(full_name)')
            .order('created_at', { ascending: false });

        if (!error && data) {
            setSupportMessages(data);
        }
        setLoadingSupport(false);
    };

    const handleUpdateSupportStatus = async (id: string, status: 'in_progress' | 'resolved') => {
        try {
            const { error } = await supabase
                .from('support_messages')
                .update({
                    status,
                    admin_response: adminResponse || null,
                    resolved_at: status === 'resolved' ? new Date().toISOString() : null
                })
                .eq('id', id);

            if (error) throw error;

            await fetchSupportMessages();
            setSelectedTicket(null);
            setAdminResponse('');
        } catch (error: any) {
            alert(error?.message || 'Erro ao atualizar pedido de suporte.');
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[2rem] border border-slate-200">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">Central de Suporte</h2>
                    <p className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest">{supportMessages.length} tickets totais</p>
                </div>
                <button
                    onClick={fetchSupportMessages}
                    disabled={loadingSupport}
                    className="flex items-center justify-center h-12 w-12 rounded-2xl bg-slate-50 text-emerald-600 hover:bg-emerald-50 transition-colors shadow-sm"
                >
                    <RefreshCw className={`w-5 h-5 ${loadingSupport ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="grid gap-4">
                {supportMessages.length === 0 && !loadingSupport && (
                    <div className="bg-dashed bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200 p-12 text-center">
                        <MessageCircle className="w-10 h-10 mx-auto text-slate-300 mb-4" />
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">Nenhuma mensagem recebida ainda.</p>
                    </div>
                )}

                {supportMessages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`bg-white rounded-[2rem] transition-all overflow-hidden ${selectedTicket?.id === msg.id ? 'border-2 border-emerald-500 shadow-xl shadow-emerald-100/50' : 'border border-slate-200 hover:border-slate-300 shadow-sm'}`}
                    >
                        <div
                            className="p-6 cursor-pointer hover:bg-slate-50/50 transition-colors"
                            onClick={() => {
                                setSelectedTicket(selectedTicket?.id === msg.id ? null : msg);
                                setAdminResponse(msg.admin_response || '');
                            }}
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex flex-wrap gap-2 items-center font-bold">
                                    <span className={`px-3 py-1.5 rounded-xl text-[9px] uppercase tracking-widest shadow-sm ${msg.status === 'open' ? 'bg-sky-100 text-sky-700 border border-sky-200' :
                                        msg.status === 'in_progress' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                                            'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                        }`}>
                                        {msg.status === 'open' ? 'Aberto' : msg.status === 'in_progress' ? 'Em curso' : 'Resolvido'}
                                    </span>
                                    <span className="text-slate-400 text-[10px] uppercase tracking-wider">{new Date(msg.created_at).toLocaleString('pt-PT')}</span>
                                </div>
                                <MessageCircle className={`w-6 h-6 ${selectedTicket?.id === msg.id ? 'text-emerald-500' : 'text-slate-300'}`} />
                            </div>
                            <h3 className="font-black text-slate-800 text-lg leading-tight mb-2 pr-8">{msg.subject}</h3>
                            <p className="text-xs text-slate-500 font-medium truncate">De: <span className="text-slate-900 font-bold">{msg.profiles?.full_name || msg.email}</span> ({msg.email})</p>
                            <div className="mt-3 flex">
                                <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg uppercase tracking-widest border border-emerald-100 truncate max-w-full">Assunto: {msg.problem_type}</span>
                            </div>
                        </div>

                        {selectedTicket?.id === msg.id && (
                            <div className="px-6 pb-6 pt-2 bg-slate-50/80 border-t border-slate-100 space-y-5 animate-in slide-in-from-top-2 duration-200">
                                <div className="bg-white p-5 rounded-2xl border border-slate-200 text-slate-700 text-sm leading-relaxed whitespace-pre-wrap font-medium shadow-inner">
                                    {msg.description}
                                </div>

                                <div className="space-y-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">A Sua Resposta (Para o Aluno ver)</label>
                                    <textarea
                                        placeholder="Escreva a resposta ou resolução..."
                                        value={adminResponse}
                                        onChange={(e) => setAdminResponse(e.target.value)}
                                        className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition-all focus:border-emerald-400 focus:bg-white font-medium resize-none shadow-inner"
                                        rows={4}
                                    />
                                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                        <button
                                            onClick={() => handleUpdateSupportStatus(msg.id, 'in_progress')}
                                            className="flex-1 bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-500 hover:text-white hover:border-amber-600 font-black py-4 rounded-xl uppercase tracking-widest text-[10px] transition-all hover:shadow-lg hover:shadow-amber-200/50"
                                        >
                                            Em Curso
                                        </button>
                                        <button
                                            onClick={() => handleUpdateSupportStatus(msg.id, 'resolved')}
                                            className="flex-1 bg-emerald-600 text-white hover:bg-emerald-500 font-black py-4 rounded-xl uppercase tracking-widest text-[10px] transition-all shadow-lg shadow-emerald-200/50 active:scale-95"
                                        >
                                            Marcar como Resolvido
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
