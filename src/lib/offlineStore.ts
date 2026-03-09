export const OFFLINE_DB_NAME = 'minsa_prep_offline_v1';
export const STORE_PENDING_XP = 'pending_xp';
export const STORE_PENDING_LOGS = 'pending_logs';

export const openOfflineDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(OFFLINE_DB_NAME, 1);

        request.onupgradeneeded = (event: any) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_PENDING_XP)) {
                db.createObjectStore(STORE_PENDING_XP, { keyPath: 'id', autoIncrement: true });
            }
            if (!db.objectStoreNames.contains(STORE_PENDING_LOGS)) {
                db.createObjectStore(STORE_PENDING_LOGS, { keyPath: 'id', autoIncrement: true });
            }
        };

        request.onsuccess = (event: any) => resolve(event.target.result);
        request.onerror = (event: any) => reject(event.target.error);
    });
};

export const savePendingXp = async (amount: number) => {
    const db = await openOfflineDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_PENDING_XP, 'readwrite');
        const store = transaction.objectStore(STORE_PENDING_XP);
        const request = store.add({ amount, timestamp: new Date().toISOString() });
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
    });
};

export const savePendingLog = async (log: any) => {
    const db = await openOfflineDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_PENDING_LOGS, 'readwrite');
        const store = transaction.objectStore(STORE_PENDING_LOGS);
        const request = store.add({ ...log, timestamp: new Date().toISOString() });
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
    });
};

export const getPendingData = async (storeName: string): Promise<any[]> => {
    const db = await openOfflineDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

export const clearPendingData = async (storeName: string, ids: number[]) => {
    const db = await openOfflineDB();
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    ids.forEach(id => store.delete(id));
    return new Promise((resolve) => {
        transaction.oncomplete = () => resolve(true);
    });
};
