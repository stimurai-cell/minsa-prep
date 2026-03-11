import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface OfflineQuestion {
    id: string;
    topic_id: string;
    content: string;
    difficulty: string;
    alternatives: Array<{
        id: string;
        content: string;
        is_correct: boolean;
    }>;
    explanation?: string;
}

interface OfflineStore {
    downloadedQuestions: OfflineQuestion[];
    isOfflineMode: boolean;
    lastDownloadAt: string | null;
    addQuestions: (questions: OfflineQuestion[]) => void;
    clearCache: () => void;
    setOfflineMode: (active: boolean) => void;
}

export const useOfflineStore = create<OfflineStore>()(
    persist(
        (set) => ({
            downloadedQuestions: [],
            isOfflineMode: false,
            lastDownloadAt: null,
            addQuestions: (questions) => set((state) => ({
                downloadedQuestions: questions,
                lastDownloadAt: new Date().toISOString()
            })),
            clearCache: () => set({ downloadedQuestions: [], lastDownloadAt: null }),
            setOfflineMode: (active) => set({ isOfflineMode: active }),
        }),
        {
            name: 'minsa-prep-offline-storage',
            storage: createJSONStorage(() => localStorage), // Usando localStorage por simplicidade, mas IndexedDB seria ideal para volumes grandes
        }
    )
);
