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
  deferredPrompt: any;
  loading: boolean;
  fetchAreas: () => Promise<void>;
  fetchTopics: (areaId: string) => Promise<void>;
  setDeferredPrompt: (prompt: any) => void;
}

const canonicalAreaNames: Record<string, string> = {
  farmacia: 'Farmácia',
  enfermagem: 'Enfermagem',
};

const toAreaKey = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .toLowerCase();

const normalizeArea = (area: Area): Area => {
  const key = toAreaKey(area.name || '');

  return {
    ...area,
    id: String(area.id),
    name: canonicalAreaNames[key] || area.name,
  };
};

const dedupeAreas = (areas: Area[]) => {
  const unique = new Map<string, Area>();

  areas.forEach((area) => {
    const normalized = normalizeArea(area);
    const key = toAreaKey(normalized.name || normalized.id);

    if (!unique.has(key)) {
      unique.set(key, normalized);
    }
  });

  return [...unique.values()];
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
      const { data, error } = await supabase.from('areas').select('*');
      if (error) throw error;
      set({ areas: dedupeAreas(data || []) });
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
