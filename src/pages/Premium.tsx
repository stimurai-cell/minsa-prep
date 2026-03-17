import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Crown, Lock, Rocket, ShieldCheck, Star, Upload, Wallet, Copy } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { premiumPlans, extraPackages, PlanPeriod } from '../lib/premium';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';

const premiumComparisons = [
  {
    title: 'Gratuito forte para entrar',
    description:
      'O gratuito deve provar valor rapidamente: treino base, prova base e progresso essencial. Serve para gerar habito e confianca.',
  },
  {
    title: 'Premium Focus como plano principal',
    description:
      'Este deve ser o plano mais promovido no app. Entrega o que mais pesa na decisao de compra: filtros, ranking, revisao e historico de desempenho.',
  },
  {
    title: 'Premium Intensivo para upsell',
    description:
      'Pacote voltado para reta final, estudantes mais comprometidos ou campanhas sazonais de exames e concursos.',
  },
];

const premiumPerks = [
  'Escolha livre de nivel no treino e na prova',
  'Ranking completo da area',
  'Leitura mais profunda do historico de desempenho',
  'Relatórios e filtros avançados para revisão',
];

const paymentMethods = [
  { bank: 'Express', value: '928047010' },
  { bank: 'BAI', value: '0040-0000-6719-8212-1017-0' },
  { bank: 'Atlantico', value: '0055-0000-1903-4290-1018-7' },
  { bank: 'BIC', value: '0051-0000-4332-6097-1014-5' },
  { bank: 'SOL', value: '0044-0000-3489-7416-1018-5' },
  // IBAN example (incluir caso precise pagamento internacional)
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
  const paidPlans = useMemo(() => premiumPlans.filter((plan) => plan.id !== 'free'), []);
  const selectedPeriod: PlanPeriod = 'monthly';
  const [selectedPlanId, setSelectedPlanId] = useState(paidPlans.find(p => p.id === 'premium')?.id || paidPlans[0]?.id || 'premium');

  const selectPlanAndScroll = (planId: string) => {
    setSelectedPlanId(planId);
    setTimeout(() => {
      const el = document.getElementById('payment-section');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
  };
  const [payerName, setPayerName] = useState(profile?.full_name || '');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [latestRequest, setLatestRequest] = useState<PaymentRequest | null>(null);
  const [copiedBank, setCopiedBank] = useState<string | null>(null);
  const [prepTime, setPrepTime] = useState('3');
  const copyToClipboard = async (val: string) => {
    try {
      await navigator.clipboard.writeText(val);
      setCopiedBank(val);
      setTimeout(() => setCopiedBank(null), 2500);
    } catch (err) {
      alert('Não foi possível copiar para a área de transferência.');
    }
  };
  const [searchParams] = useSearchParams();

  const selectedPlan = useMemo(() => {
    const all = [...premiumPlans, ...extraPackages];
    return (all.find((plan) => plan.id === selectedPlanId) || premiumPlans[1]) as any;
  }, [selectedPlanId]);

  useEffect(() => {
    setPayerName(profile?.full_name || '');
  }, [profile?.full_name]);

  useEffect(() => {
    // If someone links to /premium?plan=focus, preselect and scroll to payment
    const planFromQuery = searchParams.get('plan');
    if (planFromQuery) {
      // small delay to allow DOM to render
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
      alert('Preencha o nome, a referência e anexe o comprovativo.');
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
      const durationMonths = isExtraPackage
        ? null
        : selectedPlan.id === 'elite'
          ? 0 // 0 = vitalicio/pagamento unico
          : 1;

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
        'Comprovativo enviado. O pedido será revisto o mais rápido possível e, logo em seguida, o plano escolhido será ativado.'
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
              Benefícios do Premium para acelerar seu estudo
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-200 md:text-base">
              O Premium entrega funcionalidades pensadas para otimizar seu tempo e resultado: escolha
              livre de nível (Fácil, Normal, Difícil e Misto) para personalizar suas sessões, ranking
              completo para acompanhar sua posição, relatórios de desempenho detalhados e filtros de
              revisão avançados. Tudo para você estudar com mais foco e ver progresso real.
            </p>

            <div className="mt-6 flex flex-wrap gap-3 items-center">
              <div className="rounded-2xl bg-white/10 px-4 py-3 text-sm">
                Perfil atual: <span className="font-black">{isPremium ? 'Premium' : 'Gratuito'}</span>
              </div>
              <div className="rounded-2xl bg-emerald-400/15 px-4 py-3 text-sm text-emerald-100 flex items-center gap-3">
                <span>{isPremium ? 'Recursos premium ativos' : 'Alguns recursos premium ainda estao bloqueados'}</span>
                {isPremium && (
                  <span className="inline-flex items-center rounded-full bg-amber-200/30 px-2 py-0.5 text-xs font-semibold text-amber-900">
                    Premium
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-[1.8rem] border border-white/10 bg-white/10 p-5 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">Principais benefícios</p>
            <div className="mt-4 space-y-3">
              {premiumPerks.map((perk) => (
                <div key={perk} className="flex items-start gap-3 rounded-2xl bg-white/10 px-4 py-3 text-sm text-slate-100">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                  <div className="flex w-full items-center justify-between">
                    <span>{perk}</span>
                    <span className="ml-3 inline-flex items-center rounded-full bg-amber-200/30 px-2 py-0.5 text-xs font-semibold text-amber-900">
                      Incluído
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Seção removida: informações internas de estratégia comercial
          Mantemos apenas benefícios, planos, formas de pagamento e suporte para os clientes */}

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_24px_80px_-44px_rgba(15,23,42,0.35)] md:p-6">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">Planos</p>
            <h2 className="mt-2 text-2xl font-black text-slate-900">Escolha o seu ciclo de estudo</h2>
          </div>
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
                {plan.id === 'elite' ? 'Acesso vitalício (pagamento único)' : 'por mês'}
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
                className={`mt-5 w-full rounded-2xl px-4 py-4 text-sm font-black uppercase tracking-[0.12em] transition ${plan.highlight
                  ? 'bg-[linear-gradient(90deg,#facc15_0%,#34d399_100%)] text-slate-950 hover:opacity-90'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                  }`}
              >
                Pedir ativação deste plano
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm md:p-6 mt-8">
        <h2 className="text-2xl font-black text-slate-900 mb-2">Pacotes Extras Intensivos</h2>
        <p className="text-sm text-slate-600 mb-6">Se você já é Premium ou Elite mas precisa daquele foco final, adicione ao seu plano.</p>
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
                className="w-full rounded-xl bg-white border border-sky-200 py-2 text-sm font-bold text-sky-700 hover:bg-sky-100 transition"
              >
                Solicitar Pacote
              </button>
            </div>
          ))}
        </div>
      </section>

      {selectedPlan && (
        <section id="payment-section" className="grid gap-5 xl:grid-cols-[1fr_0.95fr]">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_24px_80px_-44px_rgba(15,23,42,0.35)] md:p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
                <Wallet className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Pagamento simples</p>
                <h2 className="text-2xl font-black text-slate-900">Transferencia e envio do comprovativo</h2>
              </div>
            </div>

            <div className="mt-5 rounded-[1.6rem] border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">
                Depois de fazer o pagamento, envie o comprovativo aqui. O pedido será revisto o mais rápido possível e, logo em seguida, o plano escolhido será ativado.
              </p>
              <p className="mt-3 text-sm text-amber-900">
                Dica: Escolha o plano acima e clique em "Pedir ativação Premium" para ir diretamente a este formulário.
              </p>
            </div>

            <div className="mt-4 rounded-[1.6rem] border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-700">Formas de pagamento</p>
              <p className="mt-2 text-sm text-slate-600">Transferência bancária (copie o número / IBAN desejado e cole no seu app bancário).</p>
              <div className="mt-3 space-y-2">
                {paymentMethods.map((m) => (
                  <div key={m.bank} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                    <div>
                      <div className="text-sm font-semibold text-slate-800">{m.bank}</div>
                      <div className="text-xs text-slate-600">{m.value}</div>
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(m.value)}
                        className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white"
                      >
                        <Copy className="h-3 w-3" />
                        {copiedBank === m.value ? 'Copiado' : 'Copiar'}
                      </button>
                    </div>
                  </div>
                ))}
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

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {paidPlans.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={`rounded-[1.4rem] border px-4 py-4 text-left transition ${selectedPlanId === plan.id
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-slate-200 bg-slate-50'
                    }`}
                >
                  <p className="text-lg font-black text-slate-900">{plan.name}</p>
                  <p className="mt-1 text-sm font-semibold text-emerald-700">{plan.prices[selectedPeriod].label}</p>
                  <p className="mt-2 text-sm text-slate-600">{plan.headline}</p>
                </button>
              ))}
            </div>

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
                <label className="mb-2 block text-sm font-semibold text-slate-700">Referência da transferência</label>
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="Ex.: referência, terminal ou número da operação"
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
              </div>

              {selectedPlanId === 'pacote_concurso' && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Tempo de preparação desejado</label>
                  <select
                    value={prepTime}
                    onChange={(e) => setPrepTime(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 bg-slate-50 font-bold"
                  >
                    <option value="1">1 Mês (Intensivo)</option>
                    <option value="3">3 Meses (Recomendado)</option>
                    <option value="6">6 Meses (Completo)</option>
                  </select>
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Observação opcional</label>
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
                disabled={submitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-4 text-sm font-black uppercase tracking-[0.12em] text-white disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                {submitting ? 'A enviar comprovativo...' : `Enviar pedido para ${selectedPlan.name}`}
              </button>
              {successMessage && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm font-semibold text-emerald-800">
                  {successMessage}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-5">
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
                        onClick={() => {
                          try {
                            navigator.clipboard.writeText(method.value);
                            setCopiedBank(method.bank);
                            setTimeout(() => setCopiedBank(null), 2500);
                          } catch (e) {
                            // fallback alert
                            alert('Copiar nao funciona no seu navegador. Copie manualmente: ' + method.value);
                          }
                        }}
                        className="ml-2 inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                      >
                        <Copy className="h-4 w-4" />
                        {copiedBank === method.bank ? 'Copiado' : 'Copiar'}
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
                Se o comprovativo demorar a carregar ou se a internet estiver fraca, o estudante pode pedir apoio por WhatsApp enquanto o pedido continua registado no sistema para revisão do admin.
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <div className="rounded-[1.8rem] border border-emerald-200 bg-emerald-50 p-5">
          <h2 className="text-xl font-black text-slate-900">Precisa de ajuda?</h2>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            Dúvidas sobre planos ou pagamentos? Fale com o suporte pelo WhatsApp: <span className="font-black">+244936793706</span>.
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
