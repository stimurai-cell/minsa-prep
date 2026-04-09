import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  Crown,
  Flame,
  Settings,
  Share,
  ShieldCheck,
  Star,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useAppStore } from '../store/useAppStore';

const AVATAR_COLORS = [
  'bg-emerald-100 text-emerald-600',
  'bg-blue-100 text-blue-600',
  'bg-purple-100 text-purple-600',
  'bg-orange-100 text-orange-600',
  'bg-pink-100 text-pink-600',
  'bg-yellow-100 text-yellow-700',
];

const headerGradientMap: Record<string, string> = {
  'bg-emerald-100 text-emerald-600': 'from-emerald-300 via-emerald-200 to-slate-50',
  'bg-blue-100 text-blue-600': 'from-sky-300 via-sky-200 to-slate-50',
  'bg-purple-100 text-purple-600': 'from-violet-300 via-fuchsia-200 to-slate-50',
  'bg-orange-100 text-orange-600': 'from-orange-300 via-amber-200 to-slate-50',
  'bg-pink-100 text-pink-600': 'from-pink-300 via-rose-200 to-slate-50',
  'bg-yellow-100 text-yellow-700': 'from-yellow-300 via-amber-200 to-slate-50',
};

const leagueBadgeMap: Record<string, string> = {
  Bronze: 'bg-orange-100 text-orange-700 border-orange-200',
  Prata: 'bg-slate-100 text-slate-700 border-slate-200',
  Ouro: 'bg-yellow-100 text-yellow-700 border-yellow-200',
};

const getBadgeVisual = (badge: any, index: number) => {
  const criteriaType = String(badge?.badges?.criteria_type || '').toLowerCase();
  const name = String(badge?.badges?.name || '').toLowerCase();

  if (criteriaType === 'streak' || /madrug|coruj|ofensiv|sequenc/.test(name)) {
    return {
      icon: Flame,
      chip: 'Sequencia',
      shell: 'from-orange-400 via-amber-300 to-yellow-200',
      tile: 'bg-orange-50 border-orange-200 text-orange-700',
      iconWrap: 'bg-white/20 text-white',
    };
  }

  if (criteriaType === 'time' || /maquina|veloc|ritmo|tempo/.test(name)) {
    return {
      icon: Zap,
      chip: 'Ritmo',
      shell: 'from-sky-500 via-cyan-400 to-emerald-200',
      tile: 'bg-sky-50 border-sky-200 text-sky-700',
      iconWrap: 'bg-white/20 text-white',
    };
  }

  if (criteriaType === 'count' || /explorador|aprend|quest/.test(name)) {
    return {
      icon: Trophy,
      chip: 'Dominio',
      shell: 'from-emerald-500 via-lime-400 to-teal-200',
      tile: 'bg-emerald-50 border-emerald-200 text-emerald-700',
      iconWrap: 'bg-white/20 text-white',
    };
  }

  if (index === 0) {
    return {
      icon: Crown,
      chip: 'Destaque',
      shell: 'from-violet-500 via-fuchsia-400 to-pink-200',
      tile: 'bg-violet-50 border-violet-200 text-violet-700',
      iconWrap: 'bg-white/20 text-white',
    };
  }

  return {
    icon: Star,
    chip: 'Conquista',
    shell: 'from-amber-400 via-yellow-300 to-orange-200',
    tile: 'bg-amber-50 border-amber-200 text-amber-700',
    iconWrap: 'bg-white/20 text-white',
  };
};

export default function Profile() {
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const { areas } = useAppStore();
  const [userBadges, setUserBadges] = useState<any[]>([]);
  const [followingCount, setFollowingCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingFriends, setFollowingFriends] = useState<any[]>([]);

  useEffect(() => {
    const fetchProfileData = async () => {
      if (!profile?.id) return;

      const [{ data: badgesData }, { count: following }, { count: followers }, { data: follows }] = await Promise.all([
        supabase
          .from('user_badges')
          .select('*, badges(*)')
          .eq('user_id', profile.id),
        supabase
          .from('user_follows')
          .select('*', { count: 'exact', head: true })
          .eq('follower_id', profile.id),
        supabase
          .from('user_follows')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', profile.id),
        supabase
          .from('user_follows')
          .select('following_id')
          .eq('follower_id', profile.id),
      ]);

      setUserBadges(badgesData || []);
      setFollowingCount(following || 0);
      setFollowersCount(followers || 0);

      if (!follows?.length) {
        setFollowingFriends([]);
        return;
      }

      const friendIds = follows.map((follow) => follow.following_id);
      const { data: friendProfiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, avatar_style, streak_count, current_league')
        .in('id', friendIds)
        .order('streak_count', { ascending: false });

      setFollowingFriends(friendProfiles || []);
    };

    void fetchProfileData();
  }, [profile?.id]);

  const selectedColorClass = profile?.avatar_style || AVATAR_COLORS[1];
  const headerGradient = headerGradientMap[selectedColorClass] || 'from-sky-300 via-sky-200 to-slate-50';
  const areaName = areas.find((area) => area.id === profile?.selected_area_id)?.name || 'Area nao definida';
  const createdAtYear = profile?.created_at ? new Date(profile.created_at).getFullYear() : '2024';
  const currentLeague = profile?.current_league || 'Bronze';
  const streakCount = profile?.streak_count || 0;
  const featuredBadge = userBadges[0];
  const remainingBadges = userBadges.slice(1, 7);
  const topFriends = followingFriends.slice(0, 8);

  const handleOpenFriendProfile = (friendId: string) => {
    navigate(`/profile/${friendId}`);
  };

  const featuredBadgeVisual = useMemo(
    () => (featuredBadge ? getBadgeVisual(featuredBadge, 0) : null),
    [featuredBadge]
  );
  const FeaturedBadgeIcon = featuredBadgeVisual?.icon;

  return (
    <div className="mx-auto max-w-3xl bg-slate-50 min-h-screen">
      <div className={`relative overflow-hidden border-b border-slate-200 bg-gradient-to-br ${headerGradient} px-6 pb-20 pt-6`}>
        <div className="absolute -right-10 top-0 h-40 w-40 rounded-full bg-white/35 blur-3xl" />
        <div className="absolute -left-10 bottom-0 h-36 w-36 rounded-full bg-white/20 blur-3xl" />

        <div className="relative z-10 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.26em] text-slate-600">Perfil</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900">
              {profile?.full_name?.split(' ')[0] || 'Aluno'}
            </h1>
            <p className="mt-2 text-sm font-semibold text-slate-600">
              Aqui desde {createdAtYear}
            </p>
          </div>

          <div className="flex gap-3">
            <button className="rounded-full bg-white/70 p-2 text-slate-700 transition hover:bg-white">
              <Share className="h-5 w-5" />
            </button>
            <Link to="/settings" className="rounded-full bg-white/70 p-2 text-slate-700 transition hover:bg-white">
              <Settings className="h-5 w-5" />
            </Link>
          </div>
        </div>

        <div className="absolute bottom-0 left-1/2 z-10 -translate-x-1/2 translate-y-1/2">
          <div className={`flex h-32 w-32 items-center justify-center overflow-hidden rounded-[2.5rem] border-4 border-slate-50 text-6xl font-black shadow-xl ${!profile?.avatar_url ? selectedColorClass : 'bg-white'}`}>
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Perfil" className="h-full w-full object-cover" />
            ) : (
              profile?.full_name?.charAt(0).toUpperCase() || 'U'
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6 px-6 pb-10 pt-24">
        <div className="text-center">
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-slate-500">
            {profile?.full_name?.replace(/\s+/g, '_').toUpperCase() || '@ALUNO'}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-center">
            <p className="text-2xl font-black text-slate-900">1</p>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Cursos</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-black text-slate-900">{followingCount}</p>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Segue</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-black text-slate-900">{followersCount}</p>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Seguidores</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            to="/social"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-black uppercase tracking-[0.14em] text-slate-700 transition hover:bg-slate-50"
          >
            <Users className="h-4 w-4" />
            Adicionar amigos
          </Link>

        </div>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">Visao geral</h2>
            <div className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${leagueBadgeMap[currentLeague] || leagueBadgeMap.Bronze}`}>
              Liga {currentLeague}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-orange-50 p-3 text-orange-500">
                  <Flame className="h-6 w-6" fill="currentColor" />
                </div>
                <div>
                  <p className="text-xl font-black text-slate-900">{streakCount} dias</p>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Ofensiva atual</p>
                </div>
              </div>
            </div>

            <div className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-yellow-50 p-3 text-yellow-500">
                  <Zap className="h-6 w-6" fill="currentColor" />
                </div>
                <div>
                  <p className="text-xl font-black text-slate-900">{profile?.total_xp || 0}</p>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Total XP</p>
                </div>
              </div>
            </div>

            <div className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-500">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xl font-black text-slate-900">{areaName}</p>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Area ativa</p>
                </div>
              </div>
            </div>

            <div className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-violet-50 p-3 text-violet-500">
                  <Crown className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xl font-black text-slate-900">{profile?.role === 'elite' ? 'Elite' : 'Estudante'}</p>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Plano atual</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Amigos</p>
              <h2 className="mt-2 text-2xl font-black text-slate-900">Ofensivas dos amigos</h2>
            </div>
            <Link
              to="/social"
              className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 transition hover:text-emerald-600"
            >
              Ver comunidade
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {topFriends.length === 0 ? (
            <div className="rounded-[1.8rem] border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
              <Users className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-500">
                Ainda nao segues amigos. Adiciona pessoas para acompanhares as ofensivas daqui.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {topFriends.map((friend, index) => (
                <button
                  key={friend.id}
                  type="button"
                  onClick={() => handleOpenFriendProfile(friend.id)}
                  className="flex items-center gap-4 rounded-[1.6rem] border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-slate-300 hover:bg-white"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-sm font-black text-slate-400 shadow-sm">
                    #{index + 1}
                  </div>

                  <div className={`flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-lg font-black shadow-sm ${friend.avatar_url ? 'bg-white' : (friend.avatar_style || 'bg-slate-200 text-slate-500')}`}>
                    {friend.avatar_url ? (
                      <img src={friend.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      friend.full_name?.charAt(0) || 'U'
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-slate-900">{friend.full_name}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-1 text-[11px] font-black text-orange-700">
                        <Flame className="h-3.5 w-3.5" fill="currentColor" />
                        {friend.streak_count || 0} dias
                      </span>
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${leagueBadgeMap[friend.current_league || 'Bronze'] || leagueBadgeMap.Bronze}`}>
                        {friend.current_league || 'Bronze'}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Conquistas</p>
              <h2 className="mt-2 text-2xl font-black text-slate-900">Medalhas desbloqueadas</h2>
            </div>
            <div className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">
              {userBadges.length} ativas
            </div>
          </div>

          {userBadges.length === 0 ? (
            <div className="rounded-[1.8rem] border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
              <Award className="mx-auto h-12 w-12 text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-500">
                Continua a estudar para desbloqueares as tuas primeiras medalhas.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {featuredBadge && featuredBadgeVisual && FeaturedBadgeIcon && (
                <div className={`relative overflow-hidden rounded-[2rem] bg-gradient-to-br ${featuredBadgeVisual.shell} p-5 text-white shadow-[0_24px_80px_-44px_rgba(15,23,42,0.55)]`}>
                  <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/20 blur-3xl" />
                  <div className="absolute -left-10 bottom-0 h-28 w-28 rounded-full bg-black/10 blur-3xl" />

                  <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`flex h-20 w-20 items-center justify-center rounded-[2rem] ${featuredBadgeVisual.iconWrap} shadow-lg backdrop-blur-sm`}>
                        <FeaturedBadgeIcon className="h-10 w-10" />
                      </div>
                      <div className="max-w-lg">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/80">{featuredBadgeVisual.chip}</p>
                        <h3 className="mt-2 text-2xl font-black tracking-tight">{featuredBadge.badges?.name}</h3>
                        <p className="mt-2 text-sm leading-6 text-white/85">{featuredBadge.badges?.description}</p>
                      </div>
                    </div>

                    <div className="rounded-[1.5rem] border border-white/25 bg-white/10 px-4 py-3 text-sm font-bold backdrop-blur-sm">
                      Destaque do perfil
                    </div>
                  </div>
                </div>
              )}

              {remainingBadges.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {remainingBadges.map((badge, index) => {
                    const visual = getBadgeVisual(badge, index + 1);
                    const Icon = visual.icon;

                    return (
                      <div key={badge.id || `${badge.badges?.name}-${index}`} className={`rounded-[1.7rem] border p-4 shadow-sm ${visual.tile}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="rounded-2xl bg-white px-3 py-3 shadow-sm">
                            <Icon className="h-6 w-6" />
                          </div>
                          <span className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em]">
                            {visual.chip}
                          </span>
                        </div>
                        <p className="mt-4 text-lg font-black leading-tight text-slate-900">{badge.badges?.name}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{badge.badges?.description}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
