import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface Area {
  id: string;
  name: string;
  description: string;
}

interface Topic {
  id: string;
  area_id: string;
  name: string;
  description: string;
}

interface AppState {
  areas: Area[];
  topics: Topic[];
  loading: boolean;
  fetchAreas: () => Promise<void>;
  fetchTopics: (areaId: string) => Promise<void>;
}

export const useAppStore = create<AppState>((set) => ({
  areas: [],
  topics: [],
  loading: false,
  fetchAreas: async () => {
    set({ loading: true });
    try {
      const { data, error } = await supabase.from('areas').select('*');
      if (error) throw error;
      set({ areas: data || [] });
    } catch (error) {
      console.error('Error fetching areas:', error);
    } finally {
      set({ loading: false });
    }
  },
  fetchTopics: async (areaId: string) => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('topics')
        .select('*')
        .eq('area_id', areaId);
      if (error) throw error;
      set({ topics: data || [] });
    } catch (error) {
      console.error('Error fetching topics:', error);
    } finally {
      set({ loading: false });
    }
  },
}));
