import { useState, useEffect, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useAppStore } from '../store/useAppStore';
import { Activity, Eye, EyeOff, Download } from 'lucide-react';
import AppLogo from '../components/AppLogo';

export default function Register() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [areaId, setAreaId] = useState('');
  const [prepTime, setPrepTime] = useState('1');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [goal, setGoal] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isStandalone, setIsStandalone] = useState(false);
  const [showInstallHelp, setShowInstallHelp] = useState(false);

  const navigate = useNavigate();
  const { checkSession } = useAuthStore();
  const { areas, fetchAreas, loading: appLoading } = useAppStore();

  useEffect(() => {
    fetchAreas();

    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true) {
      setIsStandalone(true);
    }
  }, [fetchAreas]);

  const handleInstallClick = async () => {
    const promptEvent = (window as any).deferredPrompt;
    if (promptEvent) {
      promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      if (outcome === 'accepted') {
        (window as any).deferredPrompt = null;
      }
    } else {
      setShowInstallHelp(true);
    }
  };

  const ensureProfile = async (userId: string) => {
    const profilePayload = {
      id: userId,
      full_name: fullName,
      phone: phoneNumber,
      selected_area_id: areaId || null,
      preparation_time_months: parseInt(prepTime, 10),
      goal: goal || null,
    };

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle();

      if (profile?.id) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            full_name: fullName,
            phone: phoneNumber,
            selected_area_id: areaId || null,
            preparation_time_months: parseInt(prepTime, 10),
            goal: goal || null,
          })
          .eq('id', userId);

        if (updateError) throw updateError;
        return;
      }

      await new Promise((resolve) => window.setTimeout(resolve, 350));
    }

    const { error: upsertError } = await supabase
      .from('profiles')
      .upsert(profilePayload, { onConflict: 'id' });

    if (upsertError) throw upsertError;
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();

    if (!areaId && areas.length > 0) {
      setError('Por favor, selecione uma area.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (signUpError) throw signUpError;

      if (data.user) {
        const sessionData = await supabase.auth.getSession();

        if (!sessionData.data.session) {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (signInError) throw signInError;
        }

        await ensureProfile(data.user.id);
      }

      await checkSession();
      // Depois do registo, direcionar para um quiz rapido de onboarding
      navigate('/onboarding-quiz');
    } catch (err: any) {
      const message = err?.message || 'Erro ao criar conta';

      if (message.includes('Database error saving new user')) {
        setError(
          'O Supabase recusou criar o utilizador no trigger do banco. Execute o SQL atualizado de correção e tente novamente.'
        );
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-minsa-gradient px-4 py-8 font-sans sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Elementos decorativos removidos para evitar tela embranquiçada */}

      <div className="sm:mx-auto sm:w-full sm:max-w-md z-10">
        <div className="flex justify-center">
          <AppLogo className="h-16 w-16 rounded-[1.5rem] border border-white/20 bg-white p-1.5 shadow-xl" />
        </div>
        <h2 className="mt-6 text-center text-2xl font-black tracking-tight text-white">
          Crie a sua conta
        </h2>
        <p className="mt-2 text-center text-sm text-slate-400 font-medium">
          Acesse os melhores treinos de Angola.
        </p>

        {!isStandalone && (
          <div className="mt-6 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={handleInstallClick}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-4 text-xs font-black text-slate-900 transition-all hover:bg-slate-100 uppercase tracking-widest shadow-xl"
            >
              <Download className="h-4 w-4" />
              Baixar App (PWA)
            </button>
            {showInstallHelp && (
              <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-4 text-xs text-emerald-100 text-left animate-in fade-in duration-300">
                <p className="font-bold mb-2 uppercase tracking-tight text-center">Como instalar manualmente:</p>
                <p className="mb-2"><strong>iOS (iPhone):</strong> Toque no ícone "Compartilhar" e selecione "Adicionar à Tela de Início".</p>
                <p><strong>Android:</strong> Menu do navegador e selecione "Instalar aplicativo".</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg z-10">
        <div className="rounded-[2.5rem] border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-2xl sm:px-10">
          <form className="space-y-4" onSubmit={handleRegister}>
            {error && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-300 ml-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  placeholder="Seu nome aqui"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="block w-full rounded-2xl border border-white/10 bg-white/5 py-4 px-5 text-sm text-white outline-none transition focus:border-emerald-500 focus:bg-white/10"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-300 ml-1">Email</label>
                <input
                  type="email"
                  required
                  placeholder="exemplo@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-2xl border border-white/10 bg-white/5 py-4 px-5 text-sm text-white outline-none transition focus:border-emerald-500 focus:bg-white/10"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-300 ml-1">Telefone</label>
                <input
                  type="tel"
                  required
                  placeholder="+244 9..."
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="block w-full rounded-2xl border border-white/10 bg-white/5 py-4 px-5 text-sm text-white outline-none transition focus:border-emerald-500 focus:bg-white/10"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-300 ml-1">Senha</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full rounded-2xl border border-white/10 bg-white/5 py-4 px-5 pr-14 text-sm text-white outline-none transition focus:border-emerald-500 focus:bg-white/10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 flex items-center justify-center rounded-xl text-slate-400 hover:bg-white/10"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-300 ml-1">Área de Estudo</label>
                <select
                  required
                  value={areaId}
                  onChange={(e) => setAreaId(e.target.value)}
                  className="block w-full rounded-2xl border border-white/10 bg-white/5 py-4 px-5 text-sm text-white outline-none appearance-none transition focus:border-emerald-500 focus:bg-white/10"
                >
                  <option value="" disabled className="text-slate-900">Selecione...</option>
                  {areas.map((area) => (
                    <option key={area.id} value={area.id} className="text-slate-900">{area.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-300 ml-1">Seu Objetivo</label>
                <select
                  required
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  className="block w-full rounded-2xl border border-white/10 bg-white/5 py-4 px-5 text-sm text-white outline-none appearance-none transition focus:border-emerald-500 focus:bg-white/10"
                >
                  <option value="" disabled className="text-slate-900">Selecione...</option>
                  <option value="Aprender e rever conceitos" className="text-slate-900">Aprender/Rever</option>
                  <option value="Passar no concurso publico" className="text-slate-900">Passar no Concurso</option>
                  <option value="Descontrair e treinar" className="text-slate-900">Descontrair/Treinar</option>
                </select>
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="group flex w-full items-center justify-center gap-3 rounded-2xl bg-emerald-500 py-5 text-base font-black uppercase tracking-tight text-white shadow-xl shadow-emerald-500/20 hover:bg-emerald-400 disabled:opacity-50 transition-all hover:scale-[1.02]"
              >
                {loading ? 'Processando...' : 'Criar conta'}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm font-medium text-slate-400">
              Já faz parte da nossa comunidade?{' '}
              <Link to="/login" className="font-bold text-emerald-400 hover:text-emerald-300">
                Fazer Login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
