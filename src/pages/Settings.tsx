import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Moon, Sun, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';

export default function Settings() {
    const { signOut, setUser, setProfile } = useAuthStore();
    const navigate = useNavigate();
    const [theme, setTheme] = useState(localStorage.getItem('minsa-theme') || 'dark');
    const [deletingAccount, setDeletingAccount] = useState(false);
    const [accountError, setAccountError] = useState('');

    useEffect(() => {
        if (theme === 'light') {
            document.documentElement.classList.add('light-theme');
        } else {
            document.documentElement.classList.remove('light-theme');
        }
        localStorage.setItem('minsa-theme', theme);
    }, [theme]);

    const handleSignOut = async () => {
        await signOut();
        navigate('/login');
    };

    const handleDeleteAccount = async () => {
        const confirmed = window.confirm('Esta acao vai apagar a tua conta e o teu progresso de forma permanente. Desejas continuar?');
        if (!confirmed) return;

        setDeletingAccount(true);
        setAccountError('');

        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const accessToken = sessionData.session?.access_token;

            if (!accessToken) {
                throw new Error('Sessao expirada. Inicia sessao novamente antes de excluir a conta.');
            }

            const response = await fetch('/api/delete-account', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({ confirmDeletion: true }),
            });

            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(result.error || 'Nao foi possivel excluir a conta.');
            }

            setUser(null);
            setProfile(null);
            localStorage.removeItem('minsa-prep-auth-storage');
            navigate('/welcome', { replace: true });
        } catch (error: any) {
            setAccountError(error.message || 'Nao foi possivel excluir a conta agora.');
        } finally {
            setDeletingAccount(false);
        }
    };

    return (
        <div className="mx-auto min-h-screen max-w-2xl bg-slate-50">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b-2 border-slate-100 bg-white px-4 py-4">
                <h1 className="mx-auto translate-x-3 text-xl font-black uppercase tracking-widest text-slate-400">
                    Configuracoes
                </h1>
                <Link to="/profile" className="pr-2 text-sm font-bold uppercase tracking-wide text-sky-500">
                    Pronto
                </Link>
            </div>

            <div className="animate-in fade-in space-y-6 p-4 duration-300">
                <div className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white">
                    <Link to="/settings/profile" className="flex items-center justify-between p-4 transition-colors hover:bg-slate-50 active:bg-slate-100">
                        <span className="font-bold text-slate-700">Perfil</span>
                        <ChevronRight className="h-5 w-5 text-slate-400" />
                    </Link>

                    <button
                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                        className="flex w-full items-center justify-between border-t-2 border-slate-100 p-4 text-left transition-colors hover:bg-slate-50 active:bg-slate-100"
                    >
                        <span className="flex items-center gap-3 font-bold text-slate-700">
                            {theme === 'dark' ? <Moon className="h-5 w-5 text-indigo-500" /> : <Sun className="h-5 w-5 text-amber-500" />}
                            Aparencia: {theme === 'dark' ? 'Modo Escuro' : 'Modo Claro'}
                        </span>
                        <div className={`h-6 w-12 rounded-full p-1 transition-colors ${theme === 'light' ? 'bg-amber-400' : 'bg-slate-300'}`}>
                            <div className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${theme === 'light' ? 'translate-x-6' : 'translate-x-0'}`} />
                        </div>
                    </button>

                    <button className="flex w-full items-center justify-between border-t-2 border-slate-100 p-4 text-left transition-colors hover:bg-slate-50 active:bg-slate-100">
                        <span className="font-bold text-slate-700">Notificacoes</span>
                        <ChevronRight className="h-5 w-5 text-slate-400" />
                    </button>

                    <button className="flex w-full items-center justify-between border-t-2 border-slate-100 p-4 text-left transition-colors hover:bg-slate-50 active:bg-slate-100">
                        <span className="font-bold text-slate-700">Preferencias de Cursos</span>
                        <ChevronRight className="h-5 w-5 text-slate-400" />
                    </button>

                    <button className="flex w-full items-center justify-between border-t-2 border-slate-100 p-4 text-left transition-colors hover:bg-slate-50 active:bg-slate-100">
                        <span className="font-bold text-slate-700">Configuracoes de privacidade</span>
                        <ChevronRight className="h-5 w-5 text-slate-400" />
                    </button>

                    <button
                        onClick={handleDeleteAccount}
                        disabled={deletingAccount}
                        className="flex w-full items-center justify-between border-t-2 border-slate-100 p-4 text-left transition-colors hover:bg-rose-50 active:bg-rose-100 disabled:opacity-60"
                    >
                        <span className="flex items-center gap-3 font-bold text-rose-600">
                            <Trash2 className="h-5 w-5" />
                            {deletingAccount ? 'Excluindo conta...' : 'Excluir conta'}
                        </span>
                        <ChevronRight className="h-5 w-5 text-rose-300" />
                    </button>
                </div>

                {accountError && (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
                        {accountError}
                    </div>
                )}

                <div>
                    <h2 className="mb-2 px-2 text-sm font-bold uppercase tracking-wider text-slate-500">Suporte</h2>
                    <div className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white">
                        <Link to="/help" className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-slate-50 active:bg-slate-100">
                            <span className="font-bold text-slate-700">Central de Ajuda</span>
                            <ChevronRight className="h-5 w-5 text-slate-400" />
                        </Link>
                    </div>
                </div>

                <button
                    onClick={handleSignOut}
                    className="mb-6 w-full rounded-2xl border-2 border-slate-200 bg-white py-4 font-bold uppercase tracking-wider text-sky-500 transition-colors hover:bg-slate-50 active:bg-slate-100"
                >
                    Sair
                </button>

                <div className="flex flex-col gap-3 px-2 pb-12">
                    <Link to="/terms" className="w-fit text-left text-xs font-bold uppercase tracking-widest text-sky-500 hover:text-sky-600">
                        Termos de Uso
                    </Link>
                    <Link to="/privacy" className="w-fit text-left text-xs font-bold uppercase tracking-widest text-sky-500 hover:text-sky-600">
                        Politica de Privacidade
                    </Link>
                </div>
            </div>
        </div>
    );
}
