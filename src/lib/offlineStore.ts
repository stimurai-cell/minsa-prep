export const OFFLINE_DB_NAME = 'minsa_prep_offline_v2';
export const OFFLINE_DB_VERSION = 2;

export const STORE_PENDING_XP = 'pending_xp';
export const STORE_PENDING_LOGS = 'pending_logs';
export const STORE_OFFLINE_QUESTIONS = 'offline_questions';
export const STORE_OFFLINE_META = 'offline_meta';

export interface OfflineQuestionRecord {
  id: string;
  area_id: string;
  topic_id: string;
  topic_name?: string;
  content: string;
  difficulty: string;
  alternatives: Array<{
    id: string;
    content: string;
    is_correct: boolean;
  }>;
  explanation?: string;
  cached_at: string;
}

export interface OfflineBundleMeta {
  id: 'bundle';
  areaId: string;
  questionCount: number;
  generatedAt: string;
  topicIds: string[];
  topicCount: number;
  supportsTraining: boolean;
  supportsSpeedMode: boolean;
}

export const openOfflineDB = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result as IDBDatabase;

      if (!db.objectStoreNames.contains(STORE_PENDING_XP)) {
        db.createObjectStore(STORE_PENDING_XP, { keyPath: 'id', autoIncrement: true });
      }

      if (!db.objectStoreNames.contains(STORE_PENDING_LOGS)) {
        db.createObjectStore(STORE_PENDING_LOGS, { keyPath: 'id', autoIncrement: true });
      }

      if (!db.objectStoreNames.contains(STORE_OFFLINE_QUESTIONS)) {
        db.createObjectStore(STORE_OFFLINE_QUESTIONS, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORE_OFFLINE_META)) {
        db.createObjectStore(STORE_OFFLINE_META, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event: any) => resolve(event.target.result);
    request.onerror = (event: any) => reject(event.target.error);
  });

const runStoreAction = async <T>(
  storeName: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void
): Promise<T> => {
  const db = await openOfflineDB();

  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    action(store, resolve, reject);
    transaction.onerror = () => reject(transaction.error);
  });
};

export const savePendingXp = async (amount: number) =>
  runStoreAction<boolean>(STORE_PENDING_XP, 'readwrite', (store, resolve, reject) => {
    const request = store.add({ amount, timestamp: new Date().toISOString() });
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });

export const savePendingLog = async (log: any) =>
  runStoreAction<boolean>(STORE_PENDING_LOGS, 'readwrite', (store, resolve, reject) => {
    const request = store.add({ ...log, timestamp: new Date().toISOString() });
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });

export const getPendingData = async (storeName: string): Promise<any[]> =>
  runStoreAction<any[]>(storeName, 'readonly', (store, resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });

export const clearPendingData = async (storeName: string, ids: number[]) => {
  const db = await openOfflineDB();
  const transaction = db.transaction(storeName, 'readwrite');
  const store = transaction.objectStore(storeName);
  ids.forEach((id) => store.delete(id));

  return new Promise((resolve) => {
    transaction.oncomplete = () => resolve(true);
  });
};

export const replaceOfflineQuestions = async (
  areaId: string,
  questions: OfflineQuestionRecord[]
): Promise<OfflineBundleMeta> => {
  const db = await openOfflineDB();
  const transaction = db.transaction([STORE_OFFLINE_QUESTIONS, STORE_OFFLINE_META], 'readwrite');
  const questionStore = transaction.objectStore(STORE_OFFLINE_QUESTIONS);
  const metaStore = transaction.objectStore(STORE_OFFLINE_META);
  const generatedAt = new Date().toISOString();

  const normalizedQuestions = questions.map((question) => ({
    ...question,
    area_id: areaId,
    cached_at: question.cached_at || generatedAt,
  }));

  const meta: OfflineBundleMeta = {
    id: 'bundle',
    areaId,
    questionCount: normalizedQuestions.length,
    generatedAt,
    topicIds: [...new Set(normalizedQuestions.map((question) => question.topic_id))],
    topicCount: [...new Set(normalizedQuestions.map((question) => question.topic_id))].length,
    supportsTraining: normalizedQuestions.length >= 10,
    supportsSpeedMode: normalizedQuestions.length >= 30,
  };

  return new Promise<OfflineBundleMeta>((resolve, reject) => {
    const clearQuestions = questionStore.clear();

    clearQuestions.onerror = () => reject(clearQuestions.error);
    clearQuestions.onsuccess = () => {
      normalizedQuestions.forEach((question) => questionStore.put(question));
      metaStore.put(meta);
    };

    transaction.oncomplete = () => resolve(meta);
    transaction.onerror = () => reject(transaction.error);
  });
};

export const getOfflineQuestions = async (areaId?: string | null): Promise<OfflineQuestionRecord[]> => {
  const questions = await runStoreAction<OfflineQuestionRecord[]>(
    STORE_OFFLINE_QUESTIONS,
    'readonly',
    (store, resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve((request.result as OfflineQuestionRecord[]) || []);
      request.onerror = () => reject(request.error);
    }
  );

  if (!areaId) {
    return questions;
  }

  return questions.filter((question) => question.area_id === areaId);
};

export const getOfflineBundleMeta = async (): Promise<OfflineBundleMeta | null> =>
  runStoreAction<OfflineBundleMeta | null>(STORE_OFFLINE_META, 'readonly', (store, resolve, reject) => {
    const request = store.get('bundle');
    request.onsuccess = () => resolve((request.result as OfflineBundleMeta | null) || null);
    request.onerror = () => reject(request.error);
  });

export const clearOfflineBundle = async () => {
  const db = await openOfflineDB();
  const transaction = db.transaction([STORE_OFFLINE_QUESTIONS, STORE_OFFLINE_META], 'readwrite');
  transaction.objectStore(STORE_OFFLINE_QUESTIONS).clear();
  transaction.objectStore(STORE_OFFLINE_META).clear();

  return new Promise((resolve) => {
    transaction.oncomplete = () => resolve(true);
  });
};
