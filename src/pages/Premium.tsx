import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Copy, Crown, Upload, Wallet } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { premiumPlans, extraPackages, PlanPeriod } from '../lib/premium';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';

const premiumPerks = [
  'Escolha livre de nivel no treino e na prova',
  'Ranking completo da area',
  'Leitura mais profunda do historico de desempenho',
  'Relatorios e filtros avancados para revisao',
  'Treino diario e Modo Relampago offline incluidos nos planos principais',
];

const paymentMethods = [
  { bank: 'Express', value: '928047010' },
  { bank: 'BAI', value: '0040-0000-6719-8212-1017-0' },
  { bank: 'Atlantico', value: '0055-0000-1903-4290-1018-7' },
  { bank: 'BIC', value: '0051-0000-4332-6097-1014-5' },
  { bank: 'SOL', value: '0044-0000-3489-7416-1018-5' },
  { bank: 'IBAN (EUR)', value: 'AO06 0000 0000 0000 0000 0000 0' },
];

type PaymentRequest = {
  id: string;
  plan_name: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  admin_notes?: string | null;
};

export default function Premium() {
  const { profile } = useAuthStore();
  const isPremium = ['premium', 'elite', 'admin'].includes(profile?.role || '');
  const isAdmin = profile?.role === 'admin';
  const paidPlans = useMemo(() => premiumPlans.filter((plan) => plan.id !== 'free'), []);
  const selectedPeriod: PlanPeriod = 'monthly';
  const [selectedPlanId, setSelectedPlanId] = useState(paidPlans.find((plan) => plan.id === 'premium')?.id || paidPlans[0]?.id || 'premium');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [payerName, setPayerName] = useState(profile?.full_name || '');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [latestRequest, setLatestRequest] = useState<PaymentRequest | null>(null);
  const [copiedBank, setCopiedBank] = useState<string | null>(null);
  const [prepTime, setPrepTime] = useState('3');
  const [searchParams] = useSearchParams();

  const selectPlanAndScroll = (planId: string) => {
    setSelectedPlanId(planId);
    setCheckoutOpen(true);
    setTimeout(() => {
      const el = document.getElementById('payment-section');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 200);
  };

  const copyToClipboard = async (val: string) => {
    try {
      await navigator.clipboard.writeText(val);
      setCopiedBank(val);
      setTimeout(() => setCopiedBank(null), 2500);
    } catch (err) {
      alert('Nao foi possivel copiar para a area de transferencia.');
    }
  };

  const selectedPlan = useMemo(() => {
    const all = [...premiumPlans, ...extraPackages];
    return (all.find((plan) => plan.id === selectedPlanId) || premiumPlans[1]) as any;
  }, [selectedPlanId]);

  const selectedPlanPriceLabel =
    (selectedPlan as any)?.priceLabel ||
    (selectedPlan as any)?.prices?.[selectedPeriod]?.label ||
    '';

  useEffect(() => {
    setPayerName(profile?.full_name || '');
  }, [profile?.full_name]);

  useEffect(() => {
    const planFromQuery = searchParams.get('plan');
    if (planFromQuery) {
      setCheckoutOpen(true);
      setTimeout(() => selectPlanAndScroll(planFromQuery), 200);
    }
  }, [searchParams]);

  useEffect(() => {
    const fetchLatestRequest = async () => {
      if (!profile?.id) return;

      const { data } = await supabase
        .from('payment_requests')
        .select('id, plan_name, status, created_at, admin_notes')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setLatestRequest(data as PaymentRequest);
      }
    };

    void fetchLatestRequest();
  }, [profile?.id, successMessage]);

  const handleSubmitPaymentRequest = async () => {
    if (!profile?.id || !selectedPlan || !payerName.trim() || !paymentReference.trim() || !proofFile) {
      alert('Preencha o nome, a referencia e anexe o comprovativo.');
      return;
    }

    setSubmitting(true);
    setSuccessMessage('');

    try {
      const fileExt = proofFile.name.split('.').pop() || 'jpg';
      const filePath = `${profile.id}/${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('payment-proofs')
        .upload(filePath, proofFile, { upsert: false });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('payment-proofs').getPublicUrl(filePath);

      const isExtraPackage = (selectedPlan as any).priceAmount !== undefined;
      const amount = isExtraPackage ? (selectedPlan as any).priceAmount : selectedPlan.prices[selectedPeriod].amount;
      const planLabel = isExtraPackage
        ? selectedPlan.name
        : selectedPlan.id === 'elite'
          ? `${selectedPlan.name} (vitalicio)`
          : `${selectedPlan.name} (mensal)`;
      const durationMonths = isExtraPackage ? null : selectedPlan.id === 'elite' ? 0 : 1;

      const { error: requestError } = await supabase.from('payment_requests').insert({
        user_id: profile.id,
        payer_name: payerName.trim(),
        plan_id: selectedPlan.id,
        plan_name: planLabel,
        amount_kwanza: selectedPlan.id === 'pacote_concurso' ? selectedPlan.priceAmount : amount,
        duration_months: selectedPlan.id === 'pacote_concurso' ? parseInt(prepTime) : durationMonths,
        payment_reference: paymentReference.trim(),
        proof_url: publicUrlData.publicUrl,
        proof_storage_path: filePath,
        student_note: paymentNote.trim() || null,
        status: 'pending',
      });

      if (requestError) throw requestError;

      setPaymentReference('');
      setPaymentNote('');
      setProofFile(null);
      setSuccessMessage(
        'Comprovativo enviado. O pedido sera revisto o mais rapido possivel e, logo em seguida, o plano escolhido sera ativado.'
      );
    } catch (error: any) {
      alert(error?.message || 'Erro ao enviar comprovativo.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 md:space-y-8">
      <section className="overflow-hidden rounded-[2.2rem] border border-slate-200 bg-[radial-gradient(circle_at_top_left,#fff3c4,transparent_28%),linear-gradient(135deg,#08121d_0%,#102033_56%,#114534_100%)] p-6 text-white shadow-[0_28px_90px_-48px_rgba(15,23,42,0.55)] md:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-amber-200">
              <Crown className="h-4 w-4" />
              Premium MINSA Prep
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">
              Beneficios do Premium para acelerar seu estudo
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-200 md:text-base">
              Agora o fluxo ficou em duas etapas: primeiro voce escolhe o plano, depois faz o pagamento.
              A ideia e deixar a decisao mais clara e o formulario mais leve.
            </p>

            <div className="mt-6 flex flex-wrap gap-3 items-center">
              <div className="rounded-2xl bg-white/10 px-4 py-3 text-sm">
                Perfil atual: <span className="font-black">{isPremium ? 'Premium' : 'Gratuito'}</span>
              </div>
              <div className="rounded-2xl bg-emerald-400/15 px-4 py-3 text-sm text-emerald-100">
                {checkoutOpen ? 'Etapa 2: pagamento e comprovativo' : 'Etapa 1: escolha do plano'}
              </div>
            </div>
          </div>

          <div className="rounded-[1.8rem] border border-white/10 bg-white/10 p-5 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">Principais beneficios</p>
            <div className="mt-4 space-y-3">
              {premiumPerks.map((perk) => (
                <div key={perk} className="flex items-start gap-3 rounded-2xl bg-white/10 px-4 py-3 text-sm text-slate-100">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                  <span>{perk}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_24px_80px_-44px_rgba(15,23,42,0.35)] md:p-6">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">Passo 1</p>
            <h2 className="mt-2 text-2xl font-black text-slate-900">Escolha o seu ciclo de estudo</h2>
          </div>
          <p className="text-sm text-slate-500">Escolha primeiro. O pagamento abre no passo seguinte.</p>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-3">
          {paidPlans.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-[1.8rem] border p-5 ${plan.highlight
                ? 'border-amber-300 bg-[linear-gradient(180deg,#fff4d6_0%,#ffffff_100%)] shadow-[0_24px_70px_-44px_rgba(245,158,11,0.45)]'
                : 'border-slate-200 bg-slate-50'
                }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span
                  className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${plan.highlight ? 'bg-amber-200 text-amber-900' : 'bg-white text-slate-600'
                    }`}
                >
                  {plan.badge}
                </span>
                {plan.highlight && <Crown className="h-5 w-5 text-amber-600" />}
              </div>
              <h3 className="mt-4 text-2xl font-black text-slate-900">{plan.name}</h3>
              <p className="mt-1 text-2xl font-black text-slate-900">{plan.prices[selectedPeriod].label}</p>
              <p className="mt-1 text-sm font-semibold text-emerald-700">
                {plan.id === 'elite' ? 'Acesso vitalicio (pagamento unico)' : 'por mes'}
              </p>
              <p className="mt-4 text-sm font-semibold text-slate-800">{plan.headline}</p>
              <p className="mt-3 text-sm leading-6 text-slate-600">{plan.description}</p>
              <div className="mt-5 space-y-2">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-3 rounded-2xl bg-white/80 px-4 py-3 text-sm text-slate-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span className="flex-1">{feature}</span>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => selectPlanAndScroll(plan.id)}
                disabled={isAdmin}
                className={`mt-5 w-full rounded-2xl px-4 py-4 text-sm font-black uppercase tracking-[0.12em] transition ${plan.highlight
                  ? 'bg-[linear-gradient(90deg,#facc15_0%,#34d399_100%)] text-slate-950 hover:opacity-90'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                  } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {isAdmin ? 'Bloqueado para admin' : 'Escolher e continuar'}
              </button>
            </div>
          ))}
        </div>
      </section>

      {!checkoutOpen && (
        <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Passo 2</p>
              <h2 className="mt-2 text-xl font-black text-slate-900">Pagamento so aparece depois da escolha</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Primeiro escolha um plano. So depois mostramos comprovativo, dados bancarios e envio.
              </p>
            </div>
            <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
              Fluxo mais curto, menos ruido
            </div>
          </div>
        </section>
      )}

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <h2 className="text-2xl font-black text-slate-900 mb-2">Pacotes extras intensivos</h2>
        <p className="text-sm text-slate-600 mb-6">Se voce ja e Premium ou Elite mas precisa de foco final, adicione um pacote.</p>
        <div className="grid gap-4 md:grid-cols-3">
          {extraPackages.map((pkg) => (
            <div key={pkg.id} className="rounded-2xl border border-sky-200 bg-sky-50/50 p-5">
              <h3 className="font-bold text-slate-900">{pkg.name}</h3>
              <p className="text-lg font-black text-sky-700 mt-1">{pkg.priceLabel}</p>
              <p className="text-sm text-slate-600 mt-2 mb-4">{pkg.description}</p>
              <ul className="space-y-2 mb-5">
                {pkg.features.map((feat, i) => (
                  <li key={i} className="text-xs text-slate-700 flex items-start gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-sky-500 shrink-0 mt-0.5" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => selectPlanAndScroll(pkg.id)}
                disabled={isAdmin}
                className="w-full rounded-xl bg-white border border-sky-200 py-2 text-sm font-bold text-sky-700 hover:bg-sky-100 transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isAdmin ? 'Bloqueado para admin' : 'Escolher pacote'}
              </button>
            </div>
          ))}
        </div>
      </section>

      {checkoutOpen && selectedPlan && (
        <section id="payment-section" className="grid gap-5 xl:grid-cols-[1fr_0.95fr]">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_24px_80px_-44px_rgba(15,23,42,0.35)] md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
                  <Wallet className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Passo 2</p>
                  <h2 className="text-2xl font-black text-slate-900">Transferencia e envio do comprovativo</h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCheckoutOpen(false)}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Voltar aos planos
              </button>
            </div>

            <div className="mt-5 rounded-[1.6rem] border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Plano selecionado</p>
              <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="text-xl font-black text-slate-900">{selectedPlan.name}</h3>
                  <p className="mt-1 text-sm font-semibold text-emerald-700">{selectedPlanPriceLabel}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {(selectedPlan as any).headline || selectedPlan.description}
                  </p>
                </div>
                <div className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-900">
                  {selectedPlan.id === 'elite' ? 'Pagamento unico' : 'Ativacao solicitada'}
                </div>
              </div>
            </div>

            {latestRequest && (
              <div className="mt-4 rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Ultimo pedido</p>
                <p className="mt-2 text-sm font-bold text-slate-900">{latestRequest.plan_name}</p>
                <p className="mt-1 text-sm text-slate-600">
                  Estado: <span className="font-black uppercase">{latestRequest.status}</span>
                </p>
                {latestRequest.admin_notes && (
                  <p className="mt-2 text-sm text-slate-600">Nota do admin: {latestRequest.admin_notes}</p>
                )}
              </div>
            )}

            {isAdmin && (
              <div className="mt-4 rounded-[1.4rem] border border-indigo-200 bg-indigo-50 p-4">
                <p className="text-sm font-bold text-indigo-900">
                  Conta administrativa detectada: pedidos de pagamento ficam bloqueados para evitar ativacoes acidentais.
                </p>
              </div>
            )}

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Nome de quem pagou</label>
                <input
                  type="text"
                  value={payerName}
                  onChange={(e) => setPayerName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Referencia da transferencia</label>
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="Ex.: referencia, terminal ou numero da operacao"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Comprovativo</label>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-600">
                  <Upload className="h-4 w-4" />
                  {proofFile ? proofFile.name : 'Selecionar imagem ou PDF do comprovativo'}
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
                <p className="mt-2 text-xs text-slate-500">Os dados bancarios ficam na coluna da direita para o formulario ficar mais limpo.</p>
              </div>

              {selectedPlanId === 'pacote_concurso' && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Tempo de preparacao desejado</label>
                  <select
                    value={prepTime}
                    onChange={(e) => setPrepTime(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 bg-slate-50 font-bold"
                  >
                    <option value="1">1 Mes (Intensivo)</option>
                    <option value="3">3 Meses (Recomendado)</option>
                    <option value="6">6 Meses (Completo)</option>
                  </select>
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Observacao opcional</label>
                <textarea
                  rows={3}
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="Se precisar, diga o banco, hora da transferencia ou outro detalhe util."
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="button"
                onClick={handleSubmitPaymentRequest}
                disabled={submitting || isAdmin}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-4 text-sm font-black uppercase tracking-[0.12em] text-white disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                {isAdmin ? 'Bloqueado para admin' : submitting ? 'A enviar comprovativo...' : `Enviar pedido para ${selectedPlan.name}`}
              </button>
              {successMessage && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm font-semibold text-emerald-800">
                  {successMessage}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Como funciona</p>
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  1. Escolha o plano que melhor encaixa no seu ciclo de estudo.
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  2. Faca a transferencia usando um dos dados bancarios abaixo.
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  3. Envie referencia e comprovativo para o pedido seguir para revisao.
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_24px_80px_-44px_rgba(15,23,42,0.35)] md:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Dados para transferencia</p>
              <p className="mt-3 text-lg font-black text-slate-900">Titular: JOSE SIMAO PEDRO</p>
              <div className="mt-4 space-y-3">
                {paymentMethods.map((method) => (
                  <div key={method.bank} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{method.bank}</p>
                    <div className="mt-1 flex items-center justify-between gap-3">
                      <p className="break-all text-sm font-bold text-slate-900">{method.value}</p>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(method.value)}
                        className="ml-2 inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                      >
                        <Copy className="h-4 w-4" />
                        {copiedBank === method.value ? 'Copiado' : 'Copiar'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-emerald-200 bg-emerald-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Suporte</p>
              <p className="mt-2 text-lg font-black text-slate-900">WhatsApp: 244936793706</p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                Se o comprovativo demorar a carregar ou se a internet estiver fraca, o estudante pode pedir apoio por WhatsApp enquanto o pedido continua registado no sistema para revisao do admin.
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <div className="rounded-[1.8rem] border border-emerald-200 bg-emerald-50 p-5">
          <h2 className="text-xl font-black text-slate-900">Precisa de ajuda?</h2>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            Duvidas sobre planos ou pagamentos? Fale com o suporte pelo WhatsApp: <span className="font-black">+244936793706</span>.
          </p>
        </div>

        <Link
          to="/dashboard"
          className="inline-flex items-center justify-center rounded-[1.6rem] bg-slate-950 px-6 py-4 text-sm font-bold text-white transition hover:bg-slate-800"
        >
          Voltar ao painel
        </Link>
      </section>
    </div>
  );
}
