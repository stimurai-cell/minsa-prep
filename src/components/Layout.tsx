import { useEffect, useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Award,
  BookOpen,
  ChevronDown,
  Compass,
  Crown,
  FolderTree,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Sparkles,
  Users,
  Menu,
  UserRound,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useAppStore } from '../store/useAppStore';
import { getRoleLabel } from '../lib/labels';

export default function Layout() {
  const { profile, signOut } = useAuthStore();
  const { areas, fetchAreas } = useAppStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [accountOpen, setAccountOpen] = useState(false);

  useEffect(() => {
    fetchAreas();
  }, [fetchAreas]);

  useEffect(() => {
    setAccountOpen(false);
  }, [location.pathname, location.search]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const areaName =
    areas.find((area) => area.id === profile?.selected_area_id)?.name || 'Area ainda nao definida';

  const adminLinks = [
    { to: '/admin?tab=dashboard', label: 'Visao geral', icon: LayoutDashboard, key: 'dashboard' },
    { to: '/admin?tab=content', label: 'Conteudo', icon: FolderTree, key: 'content' },
    { to: '/admin?tab=generator', label: 'Gerador', icon: Sparkles, key: 'generator' },
    { to: '/admin?tab=users', label: 'Utilizadores', icon: Users, key: 'users' },
  ];

  const studentLinks = [
    { to: '/dashboard', label: 'Painel', icon: LayoutDashboard },
    { to: '/training', label: 'Treino', icon: BookOpen },
    { to: '/simulation', label: 'Prova', icon: Compass },
    { to: '/ranking', label: 'Ranking', icon: Award },
    { to: '/premium', label: 'Premium', icon: Crown },
  ];

  const links = profile?.role === 'admin' ? adminLinks : studentLinks;
  const currentAdminTab = new URLSearchParams(location.search).get('tab') || 'dashboard';
  const isImmersiveSession =
    (location.pathname === '/training' || location.pathname === '/simulation') &&
    searchParams.get('session') === '1';

  const getLinkActive = (link: (typeof links)[number]) => {
    if (profile?.role === 'admin' && 'key' in link) {
      return location.pathname === '/admin' && currentAdminTab === link.key;
    }

    return location.pathname === link.to;
  };

  const navClass = (isActive: boolean, tone: 'student' | 'admin') =>
    [
      'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition',
      tone === 'admin'
        ? isActive
          ? 'bg-slate-900 text-white shadow-[0_18px_40px_-28px_rgba(15,23,42,0.6)]'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        : isActive
          ? 'bg-emerald-600 text-white shadow-[0_18px_40px_-28px_rgba(5,150,105,0.55)]'
          : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-700',
    ].join(' ');

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#eef7f1_52%,#f6fbf7_100%)] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className={`hidden w-80 shrink-0 border-r border-white/70 bg-[linear-gradient(180deg,#ffffff_0%,#f4fbf7_100%)] xl:flex xl:flex-col ${isImmersiveSession ? 'xl:hidden' : ''}`}>
          <div className="border-b border-slate-100 px-7 py-8">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-[1.4rem] bg-emerald-600 text-white shadow-[0_18px_40px_-18px_rgba(16,185,129,0.6)]">
                <Sparkles className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight text-emerald-700">MINSA Prep</h1>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                  Concursos da saude
                </p>
              </div>
            </div>
          </div>

          <nav className="space-y-2 px-5 py-6">
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = getLinkActive(link);

              return (
                <NavLink key={link.to} to={link.to} className={navClass(isActive, profile?.role === 'admin' ? 'admin' : 'student')}>
                  <Icon className="h-5 w-5" />
                  <span>{link.label}</span>
                </NavLink>
              );
            })}
          </nav>

          <div className="mt-auto border-t border-slate-100 px-5 py-5">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.35)]">
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

              <button
                type="button"
                onClick={() => setAccountOpen((prev) => !prev)}
                className="mt-4 flex w-full items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-left text-slate-700 transition hover:bg-slate-50"
              >
                <span className="flex items-center gap-3 text-sm font-semibold">
                  <UserRound className="h-5 w-5" />
                  Conta
                </span>
                <ChevronDown className={`h-4 w-4 transition ${accountOpen ? 'rotate-180' : ''}`} />
              </button>

              {accountOpen && (
                <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Sessao
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    A sua conta permanece ativa neste dispositivo ate sair manualmente.
                  </p>
                  <button
                    onClick={handleSignOut}
                    className="mt-4 flex w-full items-center justify-center gap-3 rounded-2xl bg-red-50 px-4 py-3 font-semibold text-red-600 transition hover:bg-red-100"
                  >
                    <LogOut className="h-5 w-5" />
                    <span>Terminar sessao</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </aside>

        <main className={`flex-1 ${isImmersiveSession ? '' : 'pb-28 xl:pb-8'}`}>
          <div className={`sticky top-0 z-30 border-b border-white/70 bg-white/85 backdrop-blur xl:hidden ${isImmersiveSession ? 'hidden' : ''}`}>
            <div className="px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-[0_18px_40px_-18px_rgba(16,185,129,0.6)]">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xl font-black tracking-tight text-emerald-700">MINSA Prep</p>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                      {profile?.role === 'admin' ? 'Ambiente admin' : 'Concursos da saude'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setAccountOpen((prev) => !prev)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600"
                  aria-label="Abrir conta"
                >
                  <UserRound className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 flex items-center gap-3 rounded-[1.5rem] border border-white/70 bg-[linear-gradient(135deg,#ffffff_0%,#f3fbf6_100%)] px-4 py-3 shadow-[0_20px_60px_-46px_rgba(15,23,42,0.35)]">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-sm font-black text-emerald-700">
                  {profile?.full_name?.charAt(0) || 'U'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-900">{profile?.full_name}</p>
                  <p className="text-xs text-slate-500">{getRoleLabel(profile?.role)}</p>
                </div>
                {profile?.role !== 'admin' ? (
                  <div className="rounded-2xl bg-yellow-50 px-3 py-2 text-right">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-yellow-700">XP</p>
                    <p className="text-lg font-black text-yellow-600">{profile?.total_xp || 0}</p>
                  </div>
                ) : (
                  <div className="rounded-2xl bg-slate-100 px-3 py-2 text-slate-600">
                    <Menu className="h-5 w-5" />
                  </div>
                )}
              </div>

              {profile?.role !== 'admin' && (
                <div className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  <span className="truncate">{areaName}</span>
                </div>
              )}

              {accountOpen && (
                <div className="mt-3 rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-[0_20px_50px_-40px_rgba(15,23,42,0.35)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Conta</p>
                  <p className="mt-2 text-sm text-slate-600">
                    A sessao fica guardada no dispositivo ate terminar manualmente.
                  </p>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="mt-4 flex w-full items-center justify-center gap-3 rounded-2xl bg-red-50 px-4 py-3 font-semibold text-red-600 transition hover:bg-red-100"
                  >
                    <LogOut className="h-5 w-5" />
                    <span>Terminar sessao</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className={isImmersiveSession ? '' : 'mx-auto max-w-7xl px-4 pb-8 pt-4 md:px-6 xl:p-8'}>
            <Outlet />
          </div>
        </main>
      </div>

      <nav className={`fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur xl:hidden ${isImmersiveSession ? 'hidden' : ''}`}>
        <div className={`mx-auto grid max-w-xl gap-2 ${profile?.role === 'admin' ? 'grid-cols-4' : 'grid-cols-5'}`}>
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = getLinkActive(link);

            return (
              <NavLink
                key={link.to}
                to={link.to}
                className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-semibold transition ${
                  profile?.role === 'admin'
                    ? isActive
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-500'
                    : isActive
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-500'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="truncate">{link.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
