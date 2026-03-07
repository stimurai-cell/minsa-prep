import { useState, useEffect, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useAppStore } from '../store/useAppStore';
import { Activity, Eye, EyeOff } from 'lucide-react';

export default function Register() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [areaId, setAreaId] = useState('');
  const [prepTime, setPrepTime] = useState('1');
  const [studentNumber, setStudentNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const navigate = useNavigate();
  const { checkSession } = useAuthStore();
  const { areas, fetchAreas, loading: appLoading } = useAppStore();

  useEffect(() => {
    fetchAreas();
  }, [fetchAreas]);

  const ensureProfile = async (userId: string) => {
    const profilePayload = {
      id: userId,
      full_name: fullName,
      student_number: studentNumber || null,
      selected_area_id: areaId || null,
      preparation_time_months: parseInt(prepTime, 10),
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
            selected_area_id: areaId || null,
            preparation_time_months: parseInt(prepTime, 10),
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
    <div className="flex min-h-screen flex-col justify-center bg-[radial-gradient(circle_at_top,#dff7ea,transparent_34%),linear-gradient(180deg,#f8fffb_0%,#eff6ff_100%)] px-4 py-12 font-sans sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-[1.6rem] bg-emerald-600 text-white shadow-[0_20px_50px_-20px_rgba(5,150,105,0.7)]">
            <Activity className="h-8 w-8" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold tracking-tight text-slate-900">
          Crie a sua conta
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          Treine como se fosse o concurso real.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="rounded-[2rem] border border-white/80 bg-white p-6 shadow-[0_28px_90px_-52px_rgba(15,23,42,0.35)] sm:px-8">
          <form className="space-y-6" onSubmit={handleRegister}>
            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700">Nome completo</label>
              <input
                type="text"
                required
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Senha</label>
              <div className="relative mt-1">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pr-14 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100"
                  aria-label={showPassword ? 'Esconder senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Área de estudo</label>
              <select
                required={areas.length > 0}
                value={areaId}
                onChange={(e) => setAreaId(e.target.value)}
                className="mt-1 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
              >
                <option value="" disabled>
                  Selecione uma área
                </option>
                {areas.length > 0 ? (
                  areas.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.name}
                    </option>
                  ))
                ) : (
                  <option value="" disabled>
                    Carregando áreas...
                  </option>
                )}
              </select>
              {areas.length === 0 && !appLoading && (
                <p className="mt-2 text-xs text-orange-600">
                  Nenhuma area encontrada. Execute o script SQL no Supabase para configurar o banco.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Número do estudante (opcional)</label>
              <input
                type="text"
                value={studentNumber}
                onChange={(e) => setStudentNumber(e.target.value)}
                className="mt-1 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Tempo de preparação</label>
              <select
                required
                value={prepTime}
                onChange={(e) => setPrepTime(e.target.value)}
                className="mt-1 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
              >
                <option value="1">1 Mês (Mensal - Intensivo)</option>
                <option value="3">3 Meses (Trimestral - Recomendado)</option>
                <option value="6">6 Meses (Semestral - Completo)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full justify-center rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? 'Criando conta...' : 'Começar a treinar'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-600">
              Já tem uma conta?{' '}
              <Link to="/login" className="font-semibold text-emerald-600 hover:text-emerald-500">
                Faça login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
