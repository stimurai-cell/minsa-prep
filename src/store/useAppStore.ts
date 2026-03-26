import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import {
  getCanonicalHealthAreaName,
  isOfficialHealthArea,
  sortAreasByCatalog,
} from '../lib/productContext';

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
  deferredPrompt: any;
  loading: boolean;
  fetchAreas: () => Promise<void>;
  fetchTopics: (areaId: string) => Promise<void>;
  setDeferredPrompt: (prompt: any) => void;
}

const normalizeArea = (area: Area): Area => ({
  ...area,
  id: String(area.id),
  name: getCanonicalHealthAreaName(area.name || ''),
});

const dedupeAreas = (areas: Area[]) => {
  const unique = new Map<string, Area>();

  areas.forEach((area) => {
    const normalized = normalizeArea(area);
    const key = normalized.name || normalized.id;

    if (!unique.has(key)) {
      unique.set(key, normalized);
    }
  });

  return sortAreasByCatalog([...unique.values()]);
};

export const useAppStore = create<AppState>((set) => ({
  areas: [],
  topics: [],
  deferredPrompt: null,
  loading: false,
  setDeferredPrompt: (prompt: any) => set({ deferredPrompt: prompt }),
  fetchAreas: async () => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('areas')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;

      const officialAreas = (data || []).filter((area) => isOfficialHealthArea(area.name || ''));
      set({ areas: dedupeAreas(officialAreas) });
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
