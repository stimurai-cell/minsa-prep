import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, Send } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { translateAuthError } from '../lib/authMessages';

export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleResetRequest = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess(false);

        try {
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password`,
            });

            if (resetError) throw resetError;
            setSuccess(true);
        } catch (err) {
            setError(translateAuthError(err, 'Nao foi possivel enviar o email de recuperacao.'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen flex-col justify-center bg-[radial-gradient(circle_at_top,#dff7ea,transparent_34%),linear-gradient(180deg,#f8fffb_0%,#eff6ff_100%)] px-4 py-12 font-sans sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="flex justify-center">
                    <Link to="/login" className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-sm transition hover:bg-emerald-50">
                        <ArrowLeft className="h-6 w-6" />
                    </Link>
                </div>
                <h2 className="mt-6 text-center text-3xl font-extrabold tracking-tight text-slate-900">
                    Recuperar senha
                </h2>
                <p className="mt-2 text-center text-sm text-slate-600">
                    Enviaremos um link seguro para redefinir a senha da sua conta.
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="rounded-[2rem] border border-white/80 bg-white p-6 shadow-[0_28px_90px_-52px_rgba(15,23,42,0.35)] sm:px-8">
                    {success ? (
                        <div className="space-y-4 text-center">
                            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                                <Send className="h-8 w-8" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900">Email enviado</h3>
                            <p className="text-sm text-slate-600">
                                Verifique a sua caixa de entrada e a pasta de spam para continuar.
                            </p>
                            <Link
                                to="/login"
                                className="mt-4 block w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
                            >
                                Voltar ao login
                            </Link>
                        </div>
                    ) : (
                        <form className="space-y-6" onSubmit={handleResetRequest}>
                            {error && (
                                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                                    {error}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-slate-700">Email</label>
                                <div className="relative mt-1">
                                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="email"
                                        required
                                        autoComplete="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="block w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
                                        placeholder="exemplo@email.com"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="flex w-full justify-center rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                            >
                                {loading ? 'Enviando...' : 'Enviar link de recuperacao'}
                            </button>

                            <div className="text-center">
                                <Link to="/login" className="text-sm font-semibold text-emerald-600 hover:text-emerald-500">
                                    Voltar ao inicio de sessao
                                </Link>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
