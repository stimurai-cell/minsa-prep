import { useEffect, useMemo } from 'react';
import {
  clearPendingData,
  getPendingData,
  STORE_PENDING_LOGS,
  STORE_PENDING_XP,
} from '../lib/offlineStore';
import { awardXp } from '../lib/xp';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useOfflineStore } from '../store/useOfflineStore';

export default function OfflineSync() {
  const { profile } = useAuthStore();
  const { syncBundle, hydrateBundle } = useOfflineStore();

  const hasOfflineAccess = useMemo(() => {
    const role = profile?.role || '';
    return (
      ['premium', 'elite', 'admin'].includes(role) ||
      (profile?.active_packages || []).includes('pacote_offline')
    );
  }, [profile?.active_packages, profile?.role]);

  useEffect(() => {
    if (!profile?.selected_area_id) return;
    void hydrateBundle(profile.selected_area_id);
  }, [hydrateBundle, profile?.selected_area_id]);

  useEffect(() => {
    const syncData = async () => {
      if (!profile?.id) return;

      if (!navigator.onLine) {
        if (profile.selected_area_id) {
          await hydrateBundle(profile.selected_area_id);
        }
        return;
      }

      try {
        const pendingXp = await getPendingData(STORE_PENDING_XP);
        if (pendingXp.length > 0) {
          for (const item of pendingXp) {
            await awardXp(profile.id, item.amount, profile.total_xp || 0);
          }
          await clearPendingData(
            STORE_PENDING_XP,
            pendingXp.map((item) => item.id)
          );
        }

        const pendingLogs = await getPendingData(STORE_PENDING_LOGS);
        if (pendingLogs.length > 0) {
          for (const log of pendingLogs) {
            const { id: _, timestamp: __, ...cleanLog } = log;
            await supabase.from('activity_logs').insert(cleanLog);
          }
          await clearPendingData(
            STORE_PENDING_LOGS,
            pendingLogs.map((item) => item.id)
          );
        }

        if (hasOfflineAccess && profile.selected_area_id) {
          await syncBundle({ areaId: profile.selected_area_id, force: false });
        }
      } catch (error) {
        console.error('Erro durante sincronizacao offline:', error);
      }
    };

    window.addEventListener('online', syncData);
    syncData();

    return () => window.removeEventListener('online', syncData);
  }, [
    hasOfflineAccess,
    hydrateBundle,
    profile?.id,
    profile?.selected_area_id,
    profile?.total_xp,
    syncBundle,
  ]);

  return null;
}
