import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface UserProfile {
  id: string;
  full_name: string;
  role: 'free' | 'basic' | 'premium' | 'elite' | 'admin';
  selected_area_id: string | null;
  preparation_time_months: number;
  total_xp?: number;
  last_active?: string | null;
  goal?: string | null;
  avatar_style?: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  current_league?: string;
  streak_freeze_active?: boolean;
  last_streak_freeze_at?: string | null;
  created_at?: string;
  active_packages?: string[];
  streak_count?: number;
}

interface AuthState {
  user: any | null;
  profile: UserProfile | null;
  loading: boolean;
  setUser: (user: any) => void;
  setProfile: (profile: UserProfile | null) => void;
  signOut: () => Promise<void>;
  refreshProfile: (userId?: string) => Promise<UserProfile | null>;
  updateLastActive: () => Promise<void>;
  checkSession: () => Promise<void>;
}

const normalizeAreaId = (value: unknown): string | null => {
  if (value === null || value === undefined || value === '') return null;
  return String(value);
};

const resolveProfileArea = async (resolvedUserId: string, profile: any): Promise<UserProfile> => {
  const normalizedProfile: UserProfile = {
    ...(profile as UserProfile),
    selected_area_id: normalizeAreaId(profile?.selected_area_id),
  };

  if (normalizedProfile.selected_area_id) {
    return normalizedProfile;
  }

  try {
    const { data: eliteProfile, error } = await supabase
      .from('elite_profiles')
      .select('selected_area_id')
      .eq('user_id', resolvedUserId)
      .maybeSingle();

    if (error) {
      console.warn('Elite profile area fallback error:', error);
      return normalizedProfile;
    }

    const fallbackAreaId = normalizeAreaId(eliteProfile?.selected_area_id);
    if (!fallbackAreaId) {
      return normalizedProfile;
    }

    const { error: syncError } = await supabase
      .from('profiles')
      .update({ selected_area_id: fallbackAreaId })
      .eq('id', resolvedUserId);

    if (syncError) {
      console.warn('Profile area sync error:', syncError);
    }

    return {
      ...normalizedProfile,
      selected_area_id: fallbackAreaId,
    };
  } catch (error) {
    console.error('Profile area resolution error:', error);
    return normalizedProfile;
  }
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  loading: true,
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, profile: null });
  },
  refreshProfile: async (userId?: string) => {
    const resolvedUserId =
      userId || (await supabase.auth.getUser()).data.user?.id;

    if (!resolvedUserId) {
      set({ profile: null });
      return null;
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', resolvedUserId)
      .single();

    if (error) {
      console.error('Profile refresh error:', error);
      // Não mostrar erro genérico para usuário - apenas log no console
      return null;
    }

    const resolvedProfile = await resolveProfileArea(resolvedUserId, profile);
    set({ profile: resolvedProfile });
    return resolvedProfile;
  },
  checkSession: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        set({ user: session.user });
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        if (profile) {
          const resolvedProfile = await resolveProfileArea(session.user.id, profile);
          set({ profile: resolvedProfile });
        }
      } else {
        set({ user: null, profile: null });
      }
    } catch (error) {
      console.error('Session check error:', error);
      // Não mostrar erro genérico para usuário - apenas log no console
    } finally {
      set({ loading: false });
    }
  },
  updateLastActive: async () => {
    const { user } = useAuthStore.getState();
    if (!user) return;

    try {
      await supabase
        .from('profiles')
        .update({ last_active: new Date().toISOString() })
        .eq('id', user.id);
    } catch (error) {
      console.error('Error updating last_active:', error);
      // Não mostrar erro genérico para usuário - apenas log no console
    }
  },
}));
