import { useEffect } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import {
  Award,
  BookOpen,
  Compass,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useAppStore } from '../store/useAppStore';
import { getRoleLabel } from '../lib/labels';

export default function Layout() {
  const { profile, signOut } = useAuthStore();
  const { areas, fetchAreas } = useAppStore();
  const navigate = useNavigate();

  useEffect(() => {
    fetchAreas();
  }, [fetchAreas]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const areaName =
    areas.find((area) => area.id === profile?.selected_area_id)?.name || 'Area ainda nao definida';

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f6f8fb_0%,#eef6f2_100%)] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col md:flex-row">
        <aside className="w-full border-b border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f5fbf7_100%)] md:min-h-screen md:w-72 md:border-b-0 md:border-r">
          <div className="border-b border-slate-100 p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-200">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight text-emerald-700">MINSA Prep</h1>
                <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
                  Concursos da saude
                </p>
              </div>
            </div>
          </div>

          <nav className="space-y-1 p-4">
            {profile?.role === 'admin' ? (
              <>
                <Link
                  to="/admin?tab=dashboard"
                  className="flex items-center gap-3 rounded-2xl px-4 py-3 text-slate-700 transition hover:bg-purple-50 hover:text-purple-700"
                >
                  <LayoutDashboard className="h-5 w-5" />
                  <span className="font-semibold">Visao geral</span>
                </Link>
                <Link
                  to="/admin?tab=generator"
                  className="flex items-center gap-3 rounded-2xl px-4 py-3 text-slate-700 transition hover:bg-purple-50 hover:text-purple-700"
                >
                  <Sparkles className="h-5 w-5" />
                  <span className="font-semibold">Gerador de conteudo</span>
                </Link>
                <Link
                  to="/admin?tab=users"
                  className="flex items-center gap-3 rounded-2xl px-4 py-3 text-slate-700 transition hover:bg-purple-50 hover:text-purple-700"
                >
                  <Users className="h-5 w-5" />
                  <span className="font-semibold">Utilizadores</span>
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/dashboard"
                  className="flex items-center gap-3 rounded-2xl px-4 py-3 text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-700"
                >
                  <LayoutDashboard className="h-5 w-5" />
                  <span className="font-semibold">Painel</span>
                </Link>
                <Link
                  to="/training"
                  className="flex items-center gap-3 rounded-2xl px-4 py-3 text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-700"
                >
                  <BookOpen className="h-5 w-5" />
                  <span className="font-semibold">Treino</span>
                </Link>
                <Link
                  to="/simulation"
                  className="flex items-center gap-3 rounded-2xl px-4 py-3 text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-700"
                >
                  <Compass className="h-5 w-5" />
                  <span className="font-semibold">Simulacao de Prova</span>
                </Link>
                <Link
                  to="/ranking"
                  className="flex items-center gap-3 rounded-2xl px-4 py-3 text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-700"
                >
                  <Award className="h-5 w-5" />
                  <span className="font-semibold">Ranking</span>
                </Link>
              </>
            )}
          </nav>

          <div className="mt-auto border-t border-slate-100 p-4">
            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-[0_18px_50px_-44px_rgba(15,23,42,0.35)]">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-sm font-black text-emerald-700">
                  {profile?.full_name?.charAt(0) || 'U'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-900">{profile?.full_name}</p>
                  <p className="mt-1 text-xs font-medium text-slate-500">{getRoleLabel(profile?.role)}</p>
                </div>
              </div>

              {profile?.role !== 'admin' && (
                <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-3">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
                    <ShieldCheck className="h-4 w-4" />
                    Area ativa
                  </div>
                  <p className="mt-2 text-sm font-bold text-slate-900">{areaName}</p>
                  <div className="mt-3 rounded-xl bg-white px-3 py-2">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-yellow-600">XP</p>
                    <p className="mt-1 text-lg font-black text-yellow-600">{profile?.total_xp || 0}</p>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleSignOut}
              className="mt-3 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-red-600 transition hover:bg-red-50"
            >
              <LogOut className="h-5 w-5" />
              <span className="font-semibold">Sair</span>
            </button>
          </div>
        </aside>

        <main className="flex-1">
          <div className="mx-auto max-w-7xl p-4 md:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
