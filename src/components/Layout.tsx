import { useEffect, useState, useMemo } from 'react';
import { Outlet, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Home,
  Dumbbell,
  UsersRound,
  LayoutDashboard,
  FolderTree,
  Users,
  Award,
  Crown,
  Sparkles,
  ShieldCheck,
  UserRound,
  ChevronDown,
  LogOut,
  Menu,
  Download,
  Megaphone,
  Zap
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useAppStore } from '../store/useAppStore';
import { getRoleLabel } from '../lib/labels';
import { supabase } from '../lib/supabase';
import ErrorBoundary from './ErrorBoundary';
import PushActivationPrompt from './PushActivationPrompt';

const APP_ICON_SRC = '/app-icon.png';

export default function Layout() {
  const { profile, signOut } = useAuthStore();
  const { areas, fetchAreas, deferredPrompt, setDeferredPrompt } = useAppStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [accountOpen, setAccountOpen] = useState(false);
  const [resolvedAreaName, setResolvedAreaName] = useState<string | null>(null);

  useEffect(() => {
    fetchAreas();
  }, [fetchAreas]);

  useEffect(() => {
    setAccountOpen(false);
  }, [location.pathname, location.search]);
  useEffect(() => {
    if (!profile?.selected_area_id) {
      setResolvedAreaName(null);
      return;
    }

    const knownAreaName = areas.find((area) => area.id === profile.selected_area_id)?.name;
    if (knownAreaName) {
      setResolvedAreaName(knownAreaName);
      return;
    }

    let active = true;
    const loadAreaName = async () => {
      const { data, error } = await supabase
        .from('areas')
        .select('name')
        .eq('id', profile.selected_area_id)
        .maybeSingle();

      if (!active) return;

      if (error) {
        console.warn('Nao foi possivel resolver a area no layout', error);
        setResolvedAreaName(null);
        return;
      }

      setResolvedAreaName(data?.name || null);
    };

    void loadAreaName();

    return () => {
      active = false;
    };
  }, [areas, profile?.selected_area_id]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const matchedAreaName = areas.find((area) => area.id === profile?.selected_area_id)?.name;
  const areaName =
    matchedAreaName ||
    resolvedAreaName ||
    (profile?.selected_area_id ? 'Carregando area...' : 'Area ainda nao definida');

  const adminLinks = [
    { to: '/admin?tab=dashboard', label: 'Visao geral', icon: LayoutDashboard, key: 'dashboard' },
    { to: '/admin?tab=payments', label: 'Pagamentos', icon: Zap, key: 'payments' },
    { to: '/admin?tab=content', label: 'Conteudo e IA', icon: FolderTree, key: 'content' },
    { to: '/admin?tab=users', label: 'Utilizadores', icon: Users, key: 'users' },
  ];

  const studentLinks = [
    { to: '/dashboard', label: 'Início', icon: Home, activeColor: 'text-emerald-500', activeBg: 'bg-emerald-100', activeBorder: 'border-emerald-200' },
    { to: '/practice', label: 'Pratique', icon: Dumbbell, activeColor: 'text-sky-500', activeBg: 'bg-sky-100', activeBorder: 'border-sky-200' },
    { to: '/social', label: 'Amigos', icon: UsersRound, activeColor: 'text-rose-500', activeBg: 'bg-rose-100', activeBorder: 'border-rose-200' },
    { to: '/leagues', label: 'Ligas', icon: ShieldCheck, activeColor: 'text-indigo-500', activeBg: 'bg-indigo-100', activeBorder: 'border-indigo-200' },
    { to: '/news', label: 'Novidades', icon: Megaphone, activeColor: 'text-blue-500', activeBg: 'bg-blue-100', activeBorder: 'border-blue-200' },
    { to: '/premium', label: 'Loja', icon: Crown, activeColor: 'text-yellow-500', activeBg: 'bg-yellow-100', activeBorder: 'border-yellow-200', isExtra: true },
    { to: '/profile', label: 'Perfil', icon: UserRound, activeColor: 'text-teal-500', activeBg: 'bg-teal-100', activeBorder: 'border-teal-200', isExtra: true },
  ];

  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const links = profile?.role === 'admin' ? adminLinks : studentLinks;

  const visibleLinks = useMemo(() => {
    if (profile?.role === 'admin') return adminLinks;
    // On mobile, if we have limited space, filter "isExtra" items for the "More" menu
    return studentLinks.filter(l => !l.isExtra);
  }, [profile?.role]);

  const extraLinks = useMemo(() => {
    return studentLinks.filter(l => l.isExtra);
  }, []);

  const currentAdminTab = new URLSearchParams(location.search).get('tab') || 'dashboard';
  const isImmersiveSession =
    (location.pathname === '/training' || location.pathname === '/simulation' || location.pathname === '/speed-mode') &&
    (searchParams.get('session') === '1' || location.pathname === '/speed-mode');

  const getLinkActive = (link: (typeof links)[number]) => {
    if (profile?.role === 'admin' && 'key' in link) {
      return location.pathname === '/admin' && currentAdminTab === link.key;
    }

    return location.pathname === link.to;
  };

  const navClass = (isActive: boolean, tone: 'student' | 'admin', link?: any) => {
    if (tone === 'admin') {
      return [
        'flex items-center gap-4 rounded-2xl px-5 py-3.5 text-base font-bold transition-all border-2',
        isActive
          ? 'bg-slate-900 border-slate-900 text-white shadow-md'
          : 'border-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-900'
      ].join(' ');
    }

    return [
      'flex items-center gap-4 rounded-2xl px-5 py-3.5 text-base font-bold transition-all border-2',
      isActive
        ? `${link.activeBg} ${link.activeBorder} ${link.activeColor} shadow-sm`
        : 'border-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-900',
    ].join(' ');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <PushActivationPrompt />
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className={`hidden w-80 shrink-0 border-r border-slate-200 bg-white xl:flex xl:flex-col ${isImmersiveSession ? 'xl:hidden' : ''}`}>
          <div className="border-b border-slate-100 px-7 py-8">
            <div className="flex flex-col items-center">
              <div className="flex h-24 w-24 items-center justify-center rounded-[2rem] border border-slate-100 bg-white p-2 shadow-xl shadow-emerald-900/5 transition-transform hover:scale-[1.02]">
                <img
                  src={APP_ICON_SRC}
                  alt="MINSA Prep Logo"
                  className="h-full w-full scale-[1.12] object-contain"
                />
              </div>
            </div>
          </div>

          <nav className="space-y-2 px-5 py-6">
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = getLinkActive(link);

              return (
                <NavLink key={link.to} to={link.to} className={navClass(isActive, profile?.role === 'admin' ? 'admin' : 'student', link)}>
                  <Icon
                    className={`h-6 w-6 ${isActive && profile?.role !== 'admin' ? (link as any).activeColor : ''}`}
                    fill={isActive ? "currentColor" : "none"}
                  />
                  <span>{link.label}</span>
                </NavLink>
              );
            })}

            {deferredPrompt && (
              <button
                onClick={() => {
                  deferredPrompt.prompt();
                  setDeferredPrompt(null);
                }}
                className="flex w-full items-center gap-4 rounded-2xl border-2 border-emerald-200 bg-emerald-50 px-5 py-3.5 text-base font-bold text-emerald-700 shadow-sm transition-all hover:bg-emerald-100"
              >
                <Download className="h-6 w-6" />
                <span>Instalar Aplicativo</span>
              </button>
            )}
          </nav>

          <div className="mt-auto border-t border-slate-100 px-5 py-5">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.35)]">
              <div className="flex items-start gap-3">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl font-black shadow-sm overflow-hidden ${!profile?.avatar_url ? (profile?.avatar_style || 'bg-emerald-100 text-emerald-700') : 'bg-white'}`}>
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    profile?.full_name?.charAt(0) || 'U'
                  )}
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
                    Área ativa
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
                    Sessão
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    A sua conta permanece ativa neste dispositivo até sair manualmente.
                  </p>
                  <button
                    onClick={handleSignOut}
                    className="mt-4 flex w-full items-center justify-center gap-3 rounded-2xl bg-red-50 px-4 py-3 font-semibold text-red-600 transition hover:bg-red-100"
                  >
                    <LogOut className="h-5 w-5" />
                    <span>Terminar sessão</span>
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
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-100 bg-white p-1 shadow-sm">
                    <img
                      src={APP_ICON_SRC}
                      alt="MINSA Prep Logo"
                      className="h-full w-full scale-[1.12] object-contain"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xl font-black tracking-tight text-emerald-700">MINSA Prep</p>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                      {profile?.role === 'admin' ? 'Ambiente admin' : 'Estudando com inteligência'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-3 rounded-[1.5rem] border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl font-black shadow-sm overflow-hidden ${!profile?.avatar_url ? (profile?.avatar_style || 'bg-emerald-100 text-emerald-700') : 'bg-white'}`}>
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    profile?.full_name?.charAt(0) || 'U'
                  )}
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
            </div>
          </div>

          {deferredPrompt && (
            <div className="mx-4 mt-4 xl:hidden">
              <button
                onClick={() => {
                  deferredPrompt.prompt();
                  setDeferredPrompt(null);
                }}
                className="flex w-full items-center justify-center gap-3 rounded-2xl bg-emerald-600 px-4 py-4 font-black uppercase tracking-tight text-white shadow-lg shadow-emerald-200"
              >
                <Download className="h-5 w-5" />
                Instalar no Telemóvel
              </button>
            </div>
          )}

          <div className={isImmersiveSession ? '' : 'mx-auto max-w-7xl px-4 pb-8 pt-4 md:px-6 xl:p-8'}>
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>

      <nav className={`fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur xl:hidden ${isImmersiveSession ? 'hidden' : ''}`}>
        <div className={`mx-auto grid max-w-xl gap-2 ${profile?.role === 'admin' ? 'grid-cols-4' : 'grid-cols-6'}`}>
          {visibleLinks.map((link) => {
            const Icon = link.icon;
            const isActive = getLinkActive(link);

            return (
              <NavLink
                key={link.to}
                to={link.to}
                className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-bold transition ${profile?.role === 'admin'
                  ? isActive
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-400'
                  : isActive
                    ? `${(link as any).activeColor} ${(link as any).activeBg} border-2 ${(link as any).activeBorder}`
                    : 'text-slate-400 border-2 border-transparent hover:bg-slate-50'
                  }`}
              >
                <Icon
                  className={`h-6 w-6 ${isActive && profile?.role !== 'admin' ? (link as any).activeColor : ''}`}
                  fill={isActive ? "currentColor" : "none"}
                />
                <span className="truncate">{link.label}</span>
              </NavLink>
            );
          })}

          {profile?.role !== 'admin' && (
            <div className="relative">
              <button
                onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                className={`flex w-full min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-bold transition border-2 ${moreMenuOpen ? 'bg-slate-100 border-slate-200 text-slate-900' : 'text-slate-400 border-transparent'}`}
              >
                <Menu className="h-6 w-6" />
                <span>Mais</span>
              </button>

              {moreMenuOpen && (
                <div className="absolute bottom-full right-0 mb-4 w-48 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white p-2 shadow-2xl animate-in fade-in slide-in-from-bottom-2">
                  {extraLinks.map((link) => {
                    const Icon = link.icon;
                    const isActive = getLinkActive(link);
                    return (
                      <NavLink
                        key={link.to}
                        to={link.to}
                        onClick={() => setMoreMenuOpen(false)}
                        className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition ${isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50'}`}
                      >
                        <Icon className="h-5 w-5" />
                        <span>{link.label}</span>
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </nav>
    </div>
  );
}

