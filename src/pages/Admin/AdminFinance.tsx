import { useEffect, useState } from 'react';
import { CheckCircle2, CreditCard, Loader2, PackagePlus, ShieldCheck, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type PaymentFilter = 'pending' | 'approved' | 'rejected' | 'all';
type UserRole = 'free' | 'basic' | 'premium' | 'elite' | 'admin';

const ROLE_ORDER: UserRole[] = ['free', 'basic', 'premium', 'elite', 'admin'];
const EXTRA_PACKAGE_IDS = new Set([
  'pacote_concurso',
  'simulacao_oficial_extra',
  'intensivo_farmacia',
  'intensivo_enfermagem',
  'pacote_offline',
]);
const PREMIUM_PLAN_IDS = new Set(['premium', 'mensal', 'trimestral', 'anual']);

const uniquePackages = (items: string[]) => [...new Set(items.filter(Boolean))];

const inferPlanId = (request: any) => {
  const explicitId = String(request.plan_id || '').trim().toLowerCase();
  if (explicitId) return explicitId;

  const planName = String(request.plan_name || '').trim().toLowerCase();
  if (!planName) return '';
  if (planName.includes('elite')) return 'elite';
  if (planName.includes('premium')) return 'premium';
  if (planName.includes('mensal')) return 'mensal';
  if (planName.includes('trimestral')) return 'trimestral';
  if (planName.includes('anual')) return 'anual';
  if (planName.includes('concurso')) return 'pacote_concurso';
  if (planName.includes('offline')) return 'pacote_offline';
  if (planName.includes('farmacia')) return 'intensivo_farmacia';
  if (planName.includes('enfermagem')) return 'intensivo_enfermagem';
  return '';
};

const resolveRoleUpgrade = (currentRole: string | undefined, requestedRole: UserRole) => {
  const safeCurrentRole = ROLE_ORDER.includes((currentRole || 'free') as UserRole)
    ? (currentRole as UserRole)
    : 'free';

  return ROLE_ORDER.indexOf(requestedRole) > ROLE_ORDER.indexOf(safeCurrentRole)
    ? requestedRole
    : safeCurrentRole;
};

const resolveProvisioning = (request: any, profile: any) => {
  const planId = inferPlanId(request);
  const updates: Record<string, any> = {};
  const currentPackages = Array.isArray(profile?.active_packages) ? profile.active_packages : [];

  if (planId === 'elite') {
    updates.role = resolveRoleUpgrade(profile?.role, 'elite');
    return { updates, planId, summary: 'Acesso Elite ativado.' };
  }

  if (PREMIUM_PLAN_IDS.has(planId)) {
    updates.role = resolveRoleUpgrade(profile?.role, 'premium');
    return { updates, planId, summary: 'Acesso Premium ativado.' };
  }

  if (EXTRA_PACKAGE_IDS.has(planId)) {
    updates.active_packages = uniquePackages([...currentPackages, planId]);
    return { updates, planId, summary: `Pacote extra ${planId} ativado.` };
  }

  return { updates, planId, summary: 'Pedido aprovado sem regra automatica de provisionamento.' };
};

export default function AdminFinance() {
  const [paymentRequests, setPaymentRequests] = useState<any[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('pending');
  const [adminPaymentNotes, setAdminPaymentNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    void fetchPaymentRequests();
  }, [paymentFilter]);

  const fetchPaymentRequests = async () => {
    setLoadingPayments(true);

    let query = supabase
      .from('payment_requests')
      .select('*, profiles(full_name, role, active_packages)')
      .order('created_at', { ascending: false });

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
    const actionLabel = status === 'approved' ? 'APROVAR' : 'REJEITAR';
    if (!window.confirm(`Tem a certeza que quer ${actionLabel} este comprovativo de ${request.profiles?.full_name || request.payer_name}?`)) {
      return;
    }

    setLoadingPayments(true);

    try {
      const adminNote = adminPaymentNotes[request.id] || '';

      const { error: updateError } = await supabase
        .from('payment_requests')
        .update({ status, admin_notes: adminNote })
        .eq('id', request.id);

      if (updateError) throw updateError;

      if (status === 'approved') {
        const { data: currentProfile, error: profileFetchError } = await supabase
          .from('profiles')
          .select('role, active_packages')
          .eq('id', request.user_id)
          .single();

        if (profileFetchError) throw profileFetchError;

        const { updates, summary } = resolveProvisioning(request, currentProfile);

        if (Object.keys(updates).length > 0) {
          const { error: profileUpdateError } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', request.user_id);

          if (profileUpdateError) throw profileUpdateError;
        }

        alert(summary);
      }

      await fetchPaymentRequests();

      setAdminPaymentNotes((prev) => {
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
            <p className="text-sm text-slate-500">Aprove comprovativos e aplique acessos principais ou extras com a regra certa.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['pending', 'approved', 'rejected', 'all'] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setPaymentFilter(filter)}
                className={`rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest transition-all ${
                  paymentFilter === filter ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-200/50' : 'bg-slate-50 text-slate-500'
                }`}
              >
                {filter === 'pending' ? 'Pendentes' : filter === 'approved' ? 'Aprovados' : filter === 'rejected' ? 'Rejeitados' : 'Todos'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loadingPayments ? (
        <div className="flex flex-col items-center rounded-[1.8rem] border border-slate-200 bg-white px-5 py-20">
          <Loader2 className="mb-4 h-10 w-10 animate-spin text-emerald-500" />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">A sincronizar faturacao...</p>
        </div>
      ) : paymentRequests.length === 0 ? (
        <div className="rounded-[1.8rem] border border-dashed border-slate-200 bg-slate-50 px-5 py-20 text-center">
          <p className="text-sm font-bold uppercase tracking-widest text-slate-500">Nenhuma fatura nesta fila.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {paymentRequests.map((request) => {
            const normalizedPlanId = inferPlanId(request);
            const currentPackages = Array.isArray(request.profiles?.active_packages) ? request.profiles.active_packages : [];

            return (
              <div key={request.id} className="rounded-[1.8rem] border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-xl">
                <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${
                          request.status === 'pending'
                            ? 'bg-amber-100 text-amber-700'
                            : request.status === 'approved'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        {request.status}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
                        {request.plan_name}
                      </span>
                      {normalizedPlanId && (
                        <span className="rounded-full bg-blue-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-blue-700">
                          {normalizedPlanId}
                        </span>
                      )}
                    </div>

                    <h3 className="mt-4 truncate text-2xl font-black leading-tight text-slate-900">
                      {request.profiles?.full_name || request.payer_name}
                    </h3>

                    <div className="mt-3 space-y-1.5 text-xs font-bold text-slate-600">
                      <p className="flex w-72 justify-between uppercase tracking-wider">
                        <span className="text-slate-400">Pacote:</span>
                        <span className="text-slate-900">{request.plan_name}</span>
                      </p>
                      <p className="flex w-72 justify-between uppercase tracking-wider">
                        <span className="text-slate-400">Valor:</span>
                        <span className="text-amber-600">{request.amount_kwanza?.toLocaleString('pt-PT')} Kz</span>
                      </p>
                      <p className="flex w-72 justify-between uppercase tracking-wider">
                        <span className="text-slate-400">Ref:</span>
                        <span className="text-slate-900">{request.payment_reference}</span>
                      </p>
                      <p className="flex w-72 justify-between uppercase tracking-wider">
                        <span className="text-slate-400">Recebido:</span>
                        <span className="text-slate-900">{new Date(request.created_at).toLocaleString('pt-PT')}</span>
                      </p>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Role atual</p>
                        <p className="mt-2 text-sm font-black text-slate-900">{request.profiles?.role || 'free'}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Pacotes ativos</p>
                        <p className="mt-2 text-sm font-black text-slate-900">
                          {currentPackages.length > 0 ? currentPackages.join(', ') : 'Nenhum extra ativo'}
                        </p>
                      </div>
                    </div>

                    {request.student_note && (
                      <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Nota do estudante</p>
                        <p className="text-sm italic font-medium text-slate-700">"{request.student_note}"</p>
                      </div>
                    )}

                    <a
                      href={request.proof_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-6 inline-flex rounded-xl border-2 border-slate-200 bg-white px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-700 transition-all hover:bg-slate-50"
                    >
                      Visualizar comprovativo
                    </a>
                  </div>

                  <div className="mt-4 w-full rounded-[1.4rem] border border-slate-100 bg-slate-50/50 p-5 xl:mt-0 xl:max-w-md">
                    <div className="mb-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                        <div className="flex items-center gap-2 text-emerald-700">
                          <ShieldCheck className="h-4 w-4" />
                          <span className="text-[10px] font-black uppercase tracking-[0.18em]">Plano principal</span>
                        </div>
                        <p className="mt-2 text-sm font-black text-slate-900">
                          {normalizedPlanId === 'elite' || PREMIUM_PLAN_IDS.has(normalizedPlanId) ? 'Sim' : 'Nao'}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
                        <div className="flex items-center gap-2 text-blue-700">
                          <PackagePlus className="h-4 w-4" />
                          <span className="text-[10px] font-black uppercase tracking-[0.18em]">Pacote extra</span>
                        </div>
                        <p className="mt-2 text-sm font-black text-slate-900">
                          {EXTRA_PACKAGE_IDS.has(normalizedPlanId) ? 'Sim' : 'Nao'}
                        </p>
                      </div>
                    </div>

                    <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">Nota da administracao</label>
                    <textarea
                      rows={3}
                      value={adminPaymentNotes[request.id] ?? request.admin_notes ?? ''}
                      onChange={(e) => setAdminPaymentNotes((prev) => ({ ...prev, [request.id]: e.target.value }))}
                      placeholder="Motivo de rejeicao ou observacoes..."
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 shadow-sm outline-none focus:border-emerald-500"
                    />

                    {request.status === 'pending' && (
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => handleReviewPayment(request, 'approved')}
                          disabled={loadingPayments}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-200/50 transition-all hover:bg-emerald-500 disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Dar acesso
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReviewPayment(request, 'rejected')}
                          disabled={loadingPayments}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-50 px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-rose-600 transition-all hover:bg-rose-100 disabled:opacity-50"
                        >
                          <XCircle className="h-4 w-4" />
                          Recusar
                        </button>
                      </div>
                    )}

                    {request.status !== 'pending' && (
                      <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                        <CreditCard className="h-4 w-4" />
                        Pedido revisto
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
