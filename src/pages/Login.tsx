import { useEffect, useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { Activity, Eye, EyeOff, Mail, ShieldCheck, Download } from 'lucide-react';
import AppLogo from '../components/AppLogo';

const REMEMBERED_EMAIL_KEY = 'minsa-prep-remembered-email';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { checkSession } = useAuthStore();
  const [isStandalone, setIsStandalone] = useState(false);
  const [showInstallHelp, setShowInstallHelp] = useState(false);

  useEffect(() => {
    // Verificar se já está instalado (standalone)
    const checkStandalone = () => {
      if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true) {
        setIsStandalone(true);
      }
    };

    checkStandalone();
  }, []);

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

  useEffect(() => {
    const rememberedEmail = window.localStorage.getItem(REMEMBERED_EMAIL_KEY);

    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRememberMe(true);
    }
  }, []);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (rememberMe) {
        window.localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
      } else {
        window.localStorage.removeItem(REMEMBERED_EMAIL_KEY);
      }

      await checkSession();
      const currentUser = useAuthStore.getState().user;
      if (currentUser) {
        await supabase.from('activity_logs').insert({
          user_id: currentUser.id,
          activity_type: 'login',
          activity_metadata: { method: 'email' }
        });
        await useAuthStore.getState().updateLastActive();
      }
      if (profile?.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-minsa-gradient px-4 py-12 font-sans sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Elementos decorativos removidos para evitar tela embranquiçada */}

      <div className="sm:mx-auto sm:w-full sm:max-w-md z-10">
        <div className="flex justify-center">
          <AppLogo className="h-20 w-20 rounded-[2rem] border border-white/20 bg-white p-2 shadow-xl" />
        </div>
        <h2 className="mt-8 text-center text-3xl font-black tracking-tight text-white">
          Entrar na sua conta
        </h2>

        {!isStandalone && (
          <div className="mt-6">
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

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10">
        <div className="rounded-[2.5rem] border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-2xl sm:px-8">
          <form className="space-y-5" onSubmit={handleLogin}>
            {error && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}

            <div className="space-y-1">
              <label className="block text-sm font-bold text-slate-300 ml-1">Email Profissional</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="exemplo@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-2xl border border-white/10 bg-white/5 py-4 pl-12 pr-4 text-sm text-white outline-none transition focus:border-emerald-500 focus:bg-white/10"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-bold text-slate-300 ml-1">Senha de Acesso</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 pr-14 text-sm text-white outline-none transition focus:border-emerald-500 focus:bg-white/10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-slate-400 transition hover:bg-white/10"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <div className="mt-2 flex justify-end">
                <Link to="/forgot-password" title="Esqueceu a senha?" className="text-xs font-bold text-emerald-400 hover:text-emerald-300">
                  Esqueceu a senha?
                </Link>
              </div>
            </div>

            <label className="flex items-start gap-3 rounded-2xl border border-white/5 bg-white/5 px-4 py-4 cursor-pointer hover:bg-white/10 transition">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="mt-1 h-5 w-5 rounded-lg border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500"
              />
              <span className="text-xs font-medium text-slate-300 leading-tight">
                Lembrar meus dados para acesso rápido neste dispositivo.
              </span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="group flex w-full items-center justify-center gap-3 rounded-2xl bg-emerald-500 px-4 py-4 text-base font-black uppercase tracking-tight text-white shadow-xl shadow-emerald-500/20 hover:bg-emerald-400 disabled:opacity-50 transition-all hover:scale-[1.02]"
            >
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  Entrar na Plataforma
                  <ShieldCheck className="h-5 w-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 space-y-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-xs uppercase tracking-widest font-bold">
                <span className="bg-transparent px-4 text-slate-500">Novo por aqui?</span>
              </div>
            </div>

            <Link
              to="/register"
              className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-emerald-500/30 bg-emerald-500/10 px-4 py-4 text-sm font-black uppercase tracking-tight text-emerald-400 hover:bg-emerald-500/20 transition-all"
            >
              Criar Conta Gratuitamente
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
