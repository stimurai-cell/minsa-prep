import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export default function AdminFinance() {
    const [paymentRequests, setPaymentRequests] = useState<any[]>([]);
    const [loadingPayments, setLoadingPayments] = useState(false);
    const [paymentFilter, setPaymentFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
    const [adminPaymentNotes, setAdminPaymentNotes] = useState<Record<string, string>>({});

    useEffect(() => {
        fetchPaymentRequests();
    }, [paymentFilter]);

    const fetchPaymentRequests = async () => {
        setLoadingPayments(true);
        let query = supabase.from('payment_requests').select('*, profiles(full_name)').order('created_at', { ascending: false });
        if (paymentFilter !== 'all') {
            query = query.eq('status', paymentFilter);
        }
        const { data, error } = await query;
        if (!error && data) {
            setPaymentRequests(data);
        }
        setLoadingPayments(false);
    };

    const handleReviewPayment = async (request: any, status: 'approved' | 'rejected') => {
        if (!window.confirm(`Tem a certeza que quer ${status === 'approved' ? 'APROVAR' : 'REJEITAR'} este comprovativo de ${request.profiles?.full_name}?`)) return;

        setLoadingPayments(true);
        try {
            const adminNote = adminPaymentNotes[request.id] || '';

            const { error: updateError } = await supabase
                .from('payment_requests')
                .update({ status, admin_notes: adminNote })
                .eq('id', request.id);

            if (updateError) throw updateError;

            if (status === 'approved') {
                const mapPlanToRole: Record<string, string> = { 'elite': 'elite', 'mensal': 'premium', 'trimestral': 'premium', 'anual': 'premium' };
                const newRole = mapPlanToRole[request.plan_name] || 'premium';

                const { error: profileError } = await supabase
                    .from('profiles')
                    .update({ role: newRole })
                    .eq('id', request.user_id);
                if (profileError) throw profileError;
            }

            await new Promise(r => setTimeout(r, 800));
            await fetchPaymentRequests();

            setAdminPaymentNotes(prev => {
                const next = { ...prev };
                delete next[request.id];
                return next;
            });
        } catch (error: any) {
            alert(error?.message || 'Erro ao rever pagamento.');
        } finally {
            setLoadingPayments(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900">Pagamentos & Planos</h2>
                        <p className="text-sm text-slate-500">Aprove comprovativos para ativar pacotes Premium ou Elite.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {(['pending', 'approved', 'rejected', 'all'] as const).map((filter) => (
                            <button
                                key={filter}
                                type="button"
                                onClick={() => setPaymentFilter(filter)}
                                className={`rounded-xl px-4 py-3 text-xs uppercase tracking-widest font-black transition-all ${paymentFilter === filter ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-200/50' : 'bg-slate-50 text-slate-500'}`}
                            >
                                {filter === 'pending' ? 'Pendentes' : filter === 'approved' ? 'Aprovados' : filter === 'rejected' ? 'Rejeitados' : 'Todos'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {loadingPayments ? (
                <div className="rounded-[1.8rem] border border-slate-200 bg-white px-5 py-20 flex flex-col items-center">
                    <Loader2 className="h-10 w-10 animate-spin text-emerald-500 mb-4" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">A Sincronizar Faturação...</p>
                </div>
            ) : paymentRequests.length === 0 ? (
                <div className="rounded-[1.8rem] border border-dashed border-slate-200 bg-slate-50 px-5 py-20 text-center">
                    <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Nenhuma fatura nesta fila.</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {paymentRequests.map((request) => (
                        <div key={request.id} className="rounded-[1.8rem] border border-slate-200 bg-white p-6 shadow-sm hover:shadow-xl transition-all group">
                            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${request.status === 'pending' ? 'bg-amber-100 text-amber-700' : request.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                            {request.status}
                                        </span>
                                        <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
                                            {request.plan_name}
                                        </span>
                                    </div>
                                    <h3 className="mt-4 text-2xl font-black text-slate-900 leading-tight truncate">
                                        {request.profiles?.full_name || request.payer_name}
                                    </h3>
                                    <div className="mt-3 space-y-1.5 text-xs text-slate-600 font-bold">
                                        <p className="flex justify-between w-64 uppercase tracking-wider"><span className="text-slate-400">Pacote:</span> <span className="text-slate-900">{request.plan_name}</span></p>
                                        <p className="flex justify-between w-64 uppercase tracking-wider"><span className="text-slate-400">Valor:</span> <span className="text-amber-600">{request.amount_kwanza?.toLocaleString('pt-PT')} Kz</span></p>
                                        <p className="flex justify-between w-64 uppercase tracking-wider"><span className="text-slate-400">Ref:</span> <span className="text-slate-900">{request.payment_reference}</span></p>
                                        <p className="flex justify-between w-64 uppercase tracking-wider"><span className="text-slate-400">Recebido:</span> <span className="text-slate-900">{new Date(request.created_at).toLocaleString('pt-PT')}</span></p>
                                    </div>

                                    {request.student_note && (
                                        <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                            <p className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-1">Nota do Estudante:</p>
                                            <p className="text-sm italic font-medium text-slate-700">"{request.student_note}"</p>
                                        </div>
                                    )}

                                    <a
                                        href={request.proof_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="mt-6 inline-flex rounded-xl border-2 border-slate-200 bg-white px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
                                    >
                                        Visualizar Comprovativo
                                    </a>
                                </div>

                                <div className="w-full xl:max-w-md rounded-[1.4rem] border border-slate-100 bg-slate-50/50 p-5 mt-4 xl:mt-0">
                                    <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">Nota da Administração (Opcional)</label>
                                    <textarea
                                        rows={3}
                                        value={adminPaymentNotes[request.id] ?? request.admin_notes ?? ''}
                                        onChange={(e) => setAdminPaymentNotes((prev) => ({ ...prev, [request.id]: e.target.value }))}
                                        placeholder="Motivo de rejeição ou observações..."
                                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500 shadow-sm"
                                    />
                                    {request.status === 'pending' && (
                                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                            <button
                                                type="button"
                                                onClick={() => handleReviewPayment(request, 'approved')}
                                                disabled={loadingPayments}
                                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-white hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-200/50 active:scale-95 disabled:opacity-50"
                                            >
                                                <CheckCircle2 className="h-4 w-4" />
                                                Dar Acesso
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleReviewPayment(request, 'rejected')}
                                                disabled={loadingPayments}
                                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-50 px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-rose-600 hover:bg-rose-100 transition-all active:scale-95 disabled:opacity-50"
                                            >
                                                <XCircle className="h-4 w-4" />
                                                Recusar
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
