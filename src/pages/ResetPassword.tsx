import { useState, FormEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ShieldCheck, Eye, EyeOff, Lock } from 'lucide-react';

export default function ResetPassword() {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        // Check if we are in a recovery flow
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                // If no session, it might be an invalid link or expired
                // Supabase often handles this by setting the session automatically if the URL has the right fragments
            }
        };
        checkSession();
    }, []);

    const handleResetPassword = async (e: FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            return setError('As senhas não coincidem');
        }
        if (password.length < 6) {
            return setError('A senha deve ter pelo menos 6 caracteres');
        }

        setLoading(true);
        setError('');

        try {
            const { error } = await supabase.auth.updateUser({
                password: password,
            });

            if (error) throw error;
            setSuccess(true);
            setTimeout(() => {
                navigate('/login');
            }, 3000);
        } catch (err: any) {
            setError(err.message || 'Erro ao atualizar senha');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen flex-col justify-center bg-[radial-gradient(circle_at_top,#dff7ea,transparent_34%),linear-gradient(180deg,#f8fffb_0%,#eff6ff_100%)] px-4 py-12 font-sans sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="flex justify-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-[1.6rem] bg-emerald-600 text-white shadow-[0_20px_50px_-20px_rgba(5,150,105,0.7)]">
                        <Lock className="h-8 w-8" />
                    </div>
                </div>
                <h2 className="mt-6 text-center text-3xl font-extrabold tracking-tight text-slate-900">
                    Redefinir Nova Senha
                </h2>
                <p className="mt-2 text-center text-sm text-slate-600">
                    Escolha uma senha forte para a sua conta.
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="rounded-[2rem] border border-white/80 bg-white p-6 shadow-[0_28px_90px_-52px_rgba(15,23,42,0.35)] sm:px-8">
                    {success ? (
                        <div className="text-center space-y-4">
                            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                                <ShieldCheck className="h-8 w-8" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900">Senha Alterada!</h3>
                            <p className="text-sm text-slate-600">
                                A sua senha foi atualizada com sucesso. A redirecionar para o login...
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
                                <label className="block text-sm font-medium text-slate-700">Nova Senha</label>
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
                                <label className="block text-sm font-medium text-slate-700">Confirmar Nova Senha</label>
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
                                {loading ? 'Atualizando...' : 'Atualizar Senha'}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
