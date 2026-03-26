import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Download, Eye, EyeOff } from 'lucide-react';
import AppLogo from '../components/AppLogo';
import { translateAuthError } from '../lib/authMessages';
import { PRODUCT_CONTEXT, STUDY_GOALS } from '../lib/productContext';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import { useAuthStore } from '../store/useAuthStore';

export default function Register() {
  const navigate = useNavigate();
  const { checkSession } = useAuthStore();
  const { areas, fetchAreas } = useAppStore();

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

  useEffect(() => {
    fetchAreas();

    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    ) {
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
      return;
    }

    setShowInstallHelp(true);
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
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(translateAuthError(err, 'Nao foi possivel criar a conta agora. Tente novamente.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col justify-center overflow-hidden bg-minsa-gradient px-4 py-8 font-sans sm:px-6 lg:px-8">
      <div className="z-10 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex items-center justify-center gap-4">
          <AppLogo className="h-16 w-16 rounded-[1.5rem] border border-white/20 bg-white p-1.5 shadow-xl" />
          <div className="text-left">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-emerald-300">MINSA</p>
            <p className="text-3xl font-black tracking-tight text-white">MINSA Prep</p>
          </div>
        </div>
        <h2 className="mt-6 text-center text-2xl font-black tracking-tight text-white">
          Crie a sua conta
        </h2>
        <p className="mt-2 text-center text-sm font-medium text-slate-400">
          {PRODUCT_CONTEXT.vision}
        </p>

        {!isStandalone && (
          <div className="mt-6 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={handleInstallClick}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-4 text-xs font-black uppercase tracking-widest text-slate-900 shadow-xl transition-all hover:bg-slate-100"
            >
              <Download className="h-4 w-4" />
              Baixar App (PWA)
            </button>
            {showInstallHelp && (
              <div className="mt-4 animate-in fade-in rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-4 text-left text-xs text-emerald-100 duration-300">
                <p className="mb-2 text-center font-bold uppercase tracking-tight">
                  Como instalar manualmente:
                </p>
                <p className="mb-2">
                  <strong>iOS (iPhone):</strong> Toque no icone "Compartilhar" e selecione
                  "Adicionar a Tela de Inicio".
                </p>
                <p>
                  <strong>Android:</strong> Menu do navegador e selecione "Instalar aplicativo".
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="z-10 mt-8 sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="rounded-[2.5rem] border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl sm:px-10">
          <form className="space-y-4" onSubmit={handleRegister}>
            {error && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="ml-1 block text-xs font-bold text-slate-300">Nome Completo</label>
                <input
                  type="text"
                  required
                  placeholder="Seu nome aqui"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="block w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-white outline-none transition focus:border-emerald-500 focus:bg-white/10"
                />
              </div>

              <div className="space-y-1">
                <label className="ml-1 block text-xs font-bold text-slate-300">Email</label>
                <input
                  type="email"
                  required
                  placeholder="exemplo@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-white outline-none transition focus:border-emerald-500 focus:bg-white/10"
                />
              </div>

              <div className="space-y-1">
                <label className="ml-1 block text-xs font-bold text-slate-300">Telefone</label>
                <input
                  type="tel"
                  required
                  placeholder="+244 9..."
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="block w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-white outline-none transition focus:border-emerald-500 focus:bg-white/10"
                />
              </div>

              <div className="space-y-1">
                <label className="ml-1 block text-xs font-bold text-slate-300">Senha</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 pr-14 text-sm text-white outline-none transition focus:border-emerald-500 focus:bg-white/10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-slate-400 hover:bg-white/10"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 pt-2 md:grid-cols-2">
              <div className="space-y-1">
                <label className="ml-1 block text-xs font-bold text-slate-300">Area de Estudo</label>
                <select
                  required
                  value={areaId}
                  onChange={(e) => setAreaId(e.target.value)}
                  className="block w-full appearance-none rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-white outline-none transition focus:border-emerald-500 focus:bg-white/10"
                >
                  <option value="" disabled className="text-slate-900">
                    Selecione...
                  </option>
                  {areas.map((area) => (
                    <option key={area.id} value={area.id} className="text-slate-900">
                      {area.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="ml-1 block text-xs font-bold text-slate-300">Seu Objetivo</label>
                <select
                  required
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  className="block w-full appearance-none rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-white outline-none transition focus:border-emerald-500 focus:bg-white/10"
                >
                  <option value="" disabled className="text-slate-900">
                    Selecione...
                  </option>
                  {STUDY_GOALS.map((studyGoal) => (
                    <option key={studyGoal} value={studyGoal} className="text-slate-900">
                      {studyGoal}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="group flex w-full items-center justify-center gap-3 rounded-2xl bg-emerald-500 py-5 text-base font-black uppercase tracking-tight text-white shadow-xl shadow-emerald-500/20 transition-all hover:scale-[1.02] hover:bg-emerald-400 disabled:opacity-50"
              >
                {loading ? 'Processando...' : 'Criar conta'}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm font-medium text-slate-400">
              Ja faz parte da nossa comunidade?{' '}
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
