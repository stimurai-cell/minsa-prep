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
      return null;
    }

    set({ profile: profile as UserProfile });
    return profile as UserProfile;
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
          set({ profile: profile as UserProfile });
        }
      } else {
        set({ user: null, profile: null });
      }
    } catch (error) {
      console.error('Session check error:', error);
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
    }
  },
}));
