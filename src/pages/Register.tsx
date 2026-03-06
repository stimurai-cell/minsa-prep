import { useState, useEffect, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useAppStore } from '../store/useAppStore';
import { Activity } from 'lucide-react';

export default function Register() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [areaId, setAreaId] = useState('');
  const [prepTime, setPrepTime] = useState('1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const navigate = useNavigate();
  const { checkSession } = useAuthStore();
  const { areas, fetchAreas, loading: appLoading } = useAppStore();

  useEffect(() => {
    fetchAreas();
  }, [fetchAreas]);

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    if (!areaId && areas.length > 0) {
      setError('Por favor, selecione uma área.');
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
            full_name: fullName
          }
        }
      });

      if (signUpError) throw signUpError;

      if (data.user) {
        // Update profile (it was created by the DB trigger)
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            full_name: fullName,
            selected_area_id: areaId || null,
            preparation_time_months: parseInt(prepTime)
          })
          .eq('id', data.user.id);

        if (profileError) throw profileError;
      }

      await checkSession();
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <Activity className="h-12 w-12 text-emerald-600" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 tracking-tight">
          Crie sua conta
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Treine como se fosse o concurso real.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm sm:rounded-2xl sm:px-10 border border-gray-100">
          <form className="space-y-6" onSubmit={handleRegister}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Nome Completo</label>
              <div className="mt-1">
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <div className="mt-1">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Senha</label>
              <div className="mt-1">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Área de Estudo</label>
              <div className="mt-1">
                <select
                  required={areas.length > 0}
                  value={areaId}
                  onChange={(e) => setAreaId(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm bg-white"
                >
                  <option value="" disabled>Selecione uma área</option>
                  {areas.length > 0 ? (
                    areas.map((area) => (
                      <option key={area.id} value={area.id}>{area.name}</option>
                    ))
                  ) : (
                    <option value="" disabled>Carregando áreas...</option>
                  )}
                </select>
                {areas.length === 0 && !appLoading && (
                  <p className="mt-2 text-xs text-orange-600">
                    Nenhuma área encontrada. Por favor, execute o script SQL no Supabase para configurar o banco.
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Tempo de Preparação</label>
              <div className="mt-1">
                <select
                  required
                  value={prepTime}
                  onChange={(e) => setPrepTime(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm bg-white"
                >
                  <option value="1">1 Mês (Intensivo)</option>
                  <option value="2">2 Meses (Moderado)</option>
                  <option value="3">3 Meses (Completo)</option>
                </select>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Criando conta...' : 'Começar a Treinar'}
              </button>
            </div>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Já tem uma conta?{' '}
              <Link to="/login" className="font-medium text-emerald-600 hover:text-emerald-500">
                Faça login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
