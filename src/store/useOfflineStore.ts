import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import {
  clearOfflineBundle,
  getOfflineBundleMeta,
  getOfflineQuestions,
  replaceOfflineQuestions,
  type OfflineBundleMeta,
  type OfflineQuestionRecord,
} from '../lib/offlineStore';

const MIN_OFFLINE_QUESTIONS = 180;
const OFFLINE_REFRESH_WINDOW_MS = 18 * 60 * 60 * 1000;

const shuffle = <T,>(items: T[]) => {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
};

const selectOfflineQuestionIds = (
  rows: Array<{ id: string; topic_id: string; difficulty: string }>,
  desiredCount = MIN_OFFLINE_QUESTIONS
) => {
  const topicBuckets = new Map<string, Array<{ id: string; difficulty: string }>>();

  rows.forEach((row) => {
    const bucket = topicBuckets.get(row.topic_id) || [];
    bucket.push({ id: row.id, difficulty: row.difficulty });
    topicBuckets.set(row.topic_id, bucket);
  });

  const perTopicQueues = [...topicBuckets.values()].map((bucket) => shuffle(bucket));
  const selectedIds: string[] = [];

  while (perTopicQueues.some((queue) => queue.length > 0) && selectedIds.length < desiredCount) {
    perTopicQueues.forEach((queue) => {
      const next = queue.shift();
      if (next && selectedIds.length < desiredCount) {
        selectedIds.push(next.id);
      }
    });
  }

  if (selectedIds.length < desiredCount) {
    const leftovers = shuffle(rows.map((row) => row.id).filter((id) => !selectedIds.includes(id)));
    selectedIds.push(...leftovers.slice(0, desiredCount - selectedIds.length));
  }

  return selectedIds.slice(0, desiredCount);
};

const shouldRefreshBundle = (
  meta: OfflineBundleMeta | null,
  areaId: string,
  force?: boolean
) => {
  if (force) return true;
  if (!meta) return true;
  if (meta.areaId !== areaId) return true;
  if (meta.questionCount < MIN_OFFLINE_QUESTIONS) return true;

  const generatedAt = new Date(meta.generatedAt).getTime();
  if (Number.isNaN(generatedAt)) return true;

  return Date.now() - generatedAt > OFFLINE_REFRESH_WINDOW_MS;
};

interface OfflineSyncResult {
  success: boolean;
  count: number;
  message?: string;
}

interface OfflineStore {
  downloadedQuestions: OfflineQuestionRecord[];
  isOfflineMode: boolean;
  lastDownloadAt: string | null;
  cachedAreaId: string | null;
  questionCount: number;
  syncState: 'idle' | 'syncing' | 'ready' | 'error';
  hydrateBundle: (areaId?: string | null) => Promise<void>;
  syncBundle: (options: { areaId?: string | null; force?: boolean }) => Promise<OfflineSyncResult>;
  clearCache: () => Promise<void>;
  setOfflineMode: (active: boolean) => void;
}

export const useOfflineStore = create<OfflineStore>()(
  persist(
    (set, get) => ({
      downloadedQuestions: [],
      isOfflineMode: false,
      lastDownloadAt: null,
      cachedAreaId: null,
      questionCount: 0,
      syncState: 'idle',
      hydrateBundle: async (areaId) => {
        try {
          const [meta, questions] = await Promise.all([
            getOfflineBundleMeta(),
            getOfflineQuestions(areaId || undefined),
          ]);

          set({
            downloadedQuestions: questions,
            lastDownloadAt: meta?.generatedAt || null,
            cachedAreaId: meta?.areaId || null,
            questionCount: questions.length,
            syncState: questions.length > 0 ? 'ready' : 'idle',
          });
        } catch (error) {
          console.error('Erro ao hidratar bundle offline:', error);
          set({ syncState: 'error' });
        }
      },
      syncBundle: async ({ areaId, force = false }) => {
        if (!areaId) {
          return { success: false, count: 0, message: 'Area do utilizador indisponivel.' };
        }

        if (!navigator.onLine) {
          await get().hydrateBundle(areaId);
          return { success: false, count: get().questionCount, message: 'Sem internet para atualizar.' };
        }

        set({ syncState: 'syncing' });

        try {
          const existingMeta = await getOfflineBundleMeta();
          if (!shouldRefreshBundle(existingMeta, areaId, force)) {
            await get().hydrateBundle(areaId);
            return {
              success: true,
              count: get().questionCount,
              message: 'Conteudo offline ja esta atualizado.',
            };
          }

          const { data: topics, error: topicsError } = await supabase
            .from('topics')
            .select('id,name')
            .eq('area_id', areaId);

          if (topicsError) throw topicsError;

          const topicIds = (topics || []).map((topic) => topic.id);
          if (!topicIds.length) {
            throw new Error('Nao ha topicos disponiveis para montar o pacote offline.');
          }

          const topicNameMap = new Map((topics || []).map((topic) => [topic.id, topic.name]));

          const { data: questionIndexRows, error: indexError } = await supabase
            .from('questions')
            .select('id,topic_id,difficulty')
            .in('topic_id', topicIds);

          if (indexError) throw indexError;
          if (!questionIndexRows?.length) {
            throw new Error('Nao ha questoes suficientes para montar o pacote offline.');
          }

          const selectedIds = selectOfflineQuestionIds(questionIndexRows, MIN_OFFLINE_QUESTIONS);

          const { data: questionRows, error: questionsError } = await supabase
            .from('questions')
            .select(`
              id,
              topic_id,
              content,
              difficulty,
              alternatives (id, content, is_correct),
              question_explanations (content)
            `)
            .in('id', selectedIds);

          if (questionsError) throw questionsError;

          const orderedQuestions = selectedIds
            .map((id) => (questionRows || []).find((row) => row.id === id))
            .filter((row): row is any => Boolean(row))
            .filter((row) => Array.isArray(row.alternatives) && row.alternatives.length >= 4)
            .map((row) => ({
              id: row.id,
              area_id: areaId,
              topic_id: row.topic_id,
              topic_name: topicNameMap.get(row.topic_id) || 'Topico',
              content: row.content,
              difficulty: row.difficulty,
              alternatives: row.alternatives,
              explanation: Array.isArray(row.question_explanations)
                ? row.question_explanations[0]?.content
                : row.question_explanations?.content,
              cached_at: new Date().toISOString(),
            })) as OfflineQuestionRecord[];

          const meta = await replaceOfflineQuestions(areaId, orderedQuestions);

          set({
            downloadedQuestions: orderedQuestions,
            lastDownloadAt: meta.generatedAt,
            cachedAreaId: meta.areaId,
            questionCount: orderedQuestions.length,
            syncState: 'ready',
          });

          return {
            success: true,
            count: orderedQuestions.length,
            message: 'Conteudo offline atualizado com sucesso.',
          };
        } catch (error) {
          console.error('Erro ao sincronizar bundle offline:', error);
          set({ syncState: 'error' });
          await get().hydrateBundle(areaId);

          return {
            success: false,
            count: get().questionCount,
            message: error instanceof Error ? error.message : 'Falha ao atualizar o conteudo offline.',
          };
        }
      },
      clearCache: async () => {
        await clearOfflineBundle();
        set({
          downloadedQuestions: [],
          lastDownloadAt: null,
          cachedAreaId: null,
          questionCount: 0,
          syncState: 'idle',
        });
      },
      setOfflineMode: (active) => set({ isOfflineMode: active }),
    }),
    {
      name: 'minsa-prep-offline-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        isOfflineMode: state.isOfflineMode,
        lastDownloadAt: state.lastDownloadAt,
        cachedAreaId: state.cachedAreaId,
        questionCount: state.questionCount,
      }),
    }
  )
);
