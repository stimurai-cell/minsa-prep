import { useEffect } from 'react';
import { getPendingData, clearPendingData, STORE_PENDING_XP, STORE_PENDING_LOGS } from '../lib/offlineStore';
import { awardXp } from '../lib/xp';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';

export default function OfflineSync() {
    const { profile } = useAuthStore();

    useEffect(() => {
        const syncData = async () => {
            if (!navigator.onLine || !profile?.id) return;

            try {
                // Sync XP
                const pendingXp = await getPendingData(STORE_PENDING_XP);
                if (pendingXp.length > 0) {
                    console.log(`Sincronizando ${pendingXp.length} entradas de XP offline...`);
                    for (const item of pendingXp) {
                        await awardXp(profile.id, item.amount, profile.total_xp || 0);
                    }
                    await clearPendingData(STORE_PENDING_XP, pendingXp.map(x => x.id));
                }

                // Sync Logs
                const pendingLogs = await getPendingData(STORE_PENDING_LOGS);
                if (pendingLogs.length > 0) {
                    console.log(`Sincronizando ${pendingLogs.length} logs de atividade offline...`);
                    for (const log of pendingLogs) {
                        // Remove the IDB id and timestamp from the metadata or body if necessary
                        // to match table schema
                        const { id: _, timestamp: __, ...cleanLog } = log;
                        await supabase.from('activity_logs').insert(cleanLog);
                    }
                    await clearPendingData(STORE_PENDING_LOGS, pendingLogs.map(l => l.id));
                }
            } catch (err) {
                console.error('Erro durante sincronização offline:', err);
            }
        };

        window.addEventListener('online', syncData);
        syncData(); // Tenta sincronizar ao montar o componente se já estiver online

        return () => window.removeEventListener('online', syncData);
    }, [profile?.id]);

    return null;
}
