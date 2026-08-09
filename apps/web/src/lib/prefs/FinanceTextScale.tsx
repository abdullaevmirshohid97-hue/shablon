'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'mubosher.financeTextSize';

/** 12px puts the smallest derived step (`fin-xs`) at 11px — the floor. */
export const MIN_TEXT_SIZE = 12;
export const MAX_TEXT_SIZE = 20;
export const DEFAULT_TEXT_SIZE = 13;

interface TextScaleContextValue {
  size: number;
  setSize: (size: number) => void;
  isDefault: boolean;
}

const TextScaleContext = createContext<TextScaleContextValue | null>(null);

function clamp(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_TEXT_SIZE;
  return Math.min(MAX_TEXT_SIZE, Math.max(MIN_TEXT_SIZE, Math.round(value)));
}

/**
 * The Finance module's own type scale.
 *
 * It publishes one CSS variable on the element it wraps, and every `text-fin-*`
 * class in the module derives its size from that variable. Two consequences,
 * both deliberate:
 *
 *  - changing it is instant and total *within* Finance — the ledger, the
 *    analytics cards and the journal all move together;
 *  - it cannot leak. The warehouse (`/hub`) is outside this wrapper, so the
 *    variable is simply not defined there and the tokens fall back to their
 *    13px default. A CEO who wants a bigger ledger does not get a bigger
 *    warehouse screen as a side effect.
 */
export function FinanceTextScaleProvider({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [size, setSizeState] = useState(DEFAULT_TEXT_SIZE);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) setSizeState(clamp(Number(stored)));
  }, []);

  const setSize = useCallback((next: number) => {
    const clamped = clamp(next);
    setSizeState(clamped);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(clamped));
    } catch {
      // Storage disabled — the size still applies for this session.
    }
  }, []);

  const value = useMemo(
    () => ({ size, setSize, isDefault: size === DEFAULT_TEXT_SIZE }),
    [size, setSize],
  );

  return (
    <TextScaleContext.Provider value={value}>
      <div
        className={className}
        style={{ ['--fin-font' as string]: `${size}px` }}
        data-finance-scope=""
      >
        {children}
      </div>
    </TextScaleContext.Provider>
  );
}

export function useFinanceTextScale() {
  const ctx = useContext(TextScaleContext);
  if (!ctx) throw new Error('useFinanceTextScale must be used within FinanceTextScaleProvider');
  return ctx;
}
