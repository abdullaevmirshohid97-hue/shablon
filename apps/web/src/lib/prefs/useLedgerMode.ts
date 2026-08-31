'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Reading and writing are different jobs, and the client page was always
 * dressed for the second one: an owner opening a client to check a balance got
 * an editable settings form, an empty entry row across the top of the ledger
 * and a pencil against every line — whether or not they had come to change
 * anything. That is noise on the way in and a mis-click on the way past.
 *
 * The mode is remembered per browser rather than per client: someone is either
 * entering the day's figures or reading the book, not switching stance client
 * by client. It starts on reading, because that is the visit that happens far
 * more often and the one where an accidental edit costs most.
 */
export type LedgerMode = 'view' | 'edit';

const MODE_STORAGE_KEY = 'mubosher.ledgerMode';

/** Half-typed rows live here, per client, until they are saved or cleared. */
export const draftStorageKey = (counterpartyId: string) => `mubosher.ledgerDraft.${counterpartyId}`;

export function hasStashedDraft(counterpartyId: string): boolean {
  try {
    return Boolean(window.localStorage.getItem(draftStorageKey(counterpartyId)));
  } catch {
    return false;
  }
}

export function useLedgerMode(): { mode: LedgerMode; setMode: (mode: LedgerMode) => void } {
  // The server cannot read localStorage, so the mode starts at the safe
  // default and settles after mount rather than making the two renders
  // disagree about what the page looks like.
  const [mode, setModeState] = useState<LedgerMode>('view');

  useEffect(() => {
    try {
      if (window.localStorage.getItem(MODE_STORAGE_KEY) === 'edit') setModeState('edit');
    } catch {
      // Storage disabled: reading mode it is.
    }
  }, []);

  const setMode = useCallback((next: LedgerMode) => {
    setModeState(next);
    try {
      window.localStorage.setItem(MODE_STORAGE_KEY, next);
    } catch {
      // Storage disabled: the switch still works, it just won't outlive the tab.
    }
  }, []);

  return { mode, setMode };
}
