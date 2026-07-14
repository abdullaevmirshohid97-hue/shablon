import { useEffect, useRef, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { getPendingCount, syncPendingTransactions } from '../lib/db/sync';

/**
 * Drains the offline queue whenever the device regains connectivity, and
 * exposes the pending count so the entry screen can show a "N ta yozuv
 * kutilmoqda" badge.
 */
export function useSyncQueue() {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncingRef = useRef(false);

  async function refreshPendingCount() {
    setPendingCount(await getPendingCount());
  }

  async function runSync() {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setIsSyncing(true);
    try {
      await syncPendingTransactions();
    } finally {
      setIsSyncing(false);
      syncingRef.current = false;
      await refreshPendingCount();
    }
  }

  useEffect(() => {
    void refreshPendingCount();

    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        void runSync();
      }
    });

    return () => unsubscribe();
  }, []);

  return { pendingCount, isSyncing, runSync };
}
