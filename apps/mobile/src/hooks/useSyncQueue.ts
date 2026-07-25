import { useCallback, useEffect, useRef, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { getPendingCount, syncPendingTransactions } from '../lib/db/sync';

/**
 * Drains the offline queue whenever the device regains connectivity, and
 * exposes the pending count plus the most recent sync failure so screens
 * can show an honest status instead of leaving rows stuck silently.
 */
export function useSyncQueue() {
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncingRef = useRef(false);

  const refreshPendingCount = useCallback(async () => {
    setPendingCount(await getPendingCount());
  }, []);

  const runSync = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setIsSyncing(true);
    try {
      const result = await syncPendingTransactions();
      setFailedCount(result.failed);
      setLastError(result.lastError);
    } catch (err) {
      setLastError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSyncing(false);
      syncingRef.current = false;
      await refreshPendingCount();
    }
  }, [refreshPendingCount]);

  useEffect(() => {
    void refreshPendingCount();

    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        void runSync();
      }
    });

    return () => unsubscribe();
  }, [refreshPendingCount, runSync]);

  return { pendingCount, failedCount, lastError, isSyncing, runSync, refreshPendingCount };
}
