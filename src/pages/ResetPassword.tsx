import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Eye, EyeOff, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { translateAuthError } from '../lib/authMessages';

export default function ResetPassword() {
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [checkingRecovery, setCheckingRecovery] = useState(true);
    const [recoveryReady, setRecoveryReady] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        const initializeRecoverySession = async () => {
            setCheckingRecovery(true);
            setError('');

            try {
                const currentUrl = new URL(window.location.href);
                const code = currentUrl.searchParams.get('code');
                const hashParams = new URLSearchParams(currentUrl.hash.replace(/^#/, ''));
                const accessToken = hashParams.get('access_token');
                const refreshToken = hashParams.get('refresh_token');

                if (code) {
                    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
                    if (exchangeError) throw exchangeError;
                } else if (accessToken && refreshToken) {
                    const { error: sessionError } = await supabase.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken,
                    });
                    if (sessionError) throw sessionError;
                }

                const {
                    data: { session },
                } = await supabase.auth.getSession();

                if (!session) {
                    throw new Error('Auth session missing!');
                }

                if (code || currentUrl.hash) {
                    window.history.replaceState({}, document.title, '/reset-password');
                }

                setRecoveryReady(true);
            } catch (err) {
                setRecoveryReady(false);
                setError(
                    translateAuthError(
                        err,
                        'Nao foi possivel validar o link de recuperacao. Peca um novo email.'
                    )
                );
            } finally {
                setCheckingRecovery(false);
            }
        };

        void initializeRecoverySession();
    }, []);

    const handleResetPassword = async (e: FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            setError('As senhas nao coincidem.');
            return;
        }

        if (password.length < 6) {
            setError('A senha deve ter pelo menos 6 caracteres.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const { error: updateError } = await supabase.auth.updateUser({
                password,
            });

            if (updateError) throw updateError;

            setSuccess(true);
            window.setTimeout(() => {
                navigate('/login', { replace: true });
            }, 3000);
        } catch (err) {
            setError(translateAuthError(err, 'Nao foi possivel atualizar a senha agora.'));
        } finally {
            setLoading(false);
        }
    };

    if (checkingRecovery) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-[radial-gradient(circle_at_top,#dff7ea,transparent_34%),linear-gradient(180deg,#f8fffb_0%,#eff6ff_100%)] px-4 py-12 font-sans">
                <div className="rounded-[2rem] border border-white/80 bg-white px-8 py-10 text-center shadow-[0_28px_90px_-52px_rgba(15,23,42,0.35)]">
                    <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-600" />
                    <p className="mt-5 text-lg font-black text-slate-900">A validar o link de recuperacao</p>
                    <p className="mt-2 text-sm text-slate-600">Estamos a preparar a sua sessao de seguranca.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col justify-center bg-[radial-gradient(circle_at_top,#dff7ea,transparent_34%),linear-gradient(180deg,#f8fffb_0%,#eff6ff_100%)] px-4 py-12 font-sans sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="flex justify-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-[1.6rem] bg-emerald-600 text-white shadow-[0_20px_50px_-20px_rgba(5,150,105,0.7)]">
                        <Lock className="h-8 w-8" />
                    </div>
                </div>
                <h2 className="mt-6 text-center text-3xl font-extrabold tracking-tight text-slate-900">
                    Definir nova senha
                </h2>
                <p className="mt-2 text-center text-sm text-slate-600">
                    Escolha uma senha forte para voltar ao MINSA Prep com seguranca.
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="rounded-[2rem] border border-white/80 bg-white p-6 shadow-[0_28px_90px_-52px_rgba(15,23,42,0.35)] sm:px-8">
                    {!recoveryReady && !success ? (
                        <div className="space-y-4 text-center">
                            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                                <Lock className="h-8 w-8" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900">Link invalido ou expirado</h3>
                            <p className="text-sm text-slate-600">
                                Peca um novo email de recuperacao para continuar.
                            </p>
                            {error && (
                                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                                    {error}
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={() => navigate('/forgot-password')}
                                className="flex w-full justify-center rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
                            >
                                Pedir novo link
                            </button>
                        </div>
                    ) : success ? (
                        <div className="text-center space-y-4">
                            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                                <ShieldCheck className="h-8 w-8" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900">Senha atualizada</h3>
                            <p className="text-sm text-slate-600">
                                A sua senha foi alterada com sucesso. Vamos leva-lo ao login.
                            </p>
                        </div>
                    ) : (
                        <form className="space-y-6" onSubmit={handleResetPassword}>
                            {error && (
                                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                                    {error}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-slate-700">Nova senha</label>
                                <div className="relative mt-1">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pr-14 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((prev) => !prev)}
                                        className="absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100"
                                    >
                                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700">Confirmar nova senha</label>
                                <div className="relative mt-1">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pr-14 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="flex w-full justify-center rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                            >
                                {loading ? 'Atualizando...' : 'Atualizar senha'}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
