'use client';

import { useRef } from 'react';
import { useLocale } from '@/lib/i18n/LocaleProvider';

export type PrintMode = 'statement' | 'act';

/**
 * What is about to come out of the printer, chosen before it does.
 *
 * This replaces a `window.confirm` that asked whether to include the analytics
 * and had no way to ask anything else — so the reconciliation act, which is a
 * different document rather than a different option, had nowhere to live. A
 * native <details> keeps it to no state and no outside-click handling; the
 * panel closes when a choice is made.
 */
export function PrintMenu({
  withAnalytics,
  onWithAnalyticsChange,
  onPrint,
}: {
  withAnalytics: boolean;
  onWithAnalyticsChange: (value: boolean) => void;
  onPrint: (mode: PrintMode) => void;
}) {
  const { t } = useLocale();
  const details = useRef<HTMLDetailsElement>(null);

  function choose(mode: PrintMode) {
    if (details.current) details.current.open = false;
    onPrint(mode);
  }

  const item =
    'flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-slate-100';

  return (
    <details ref={details} className="no-print relative">
      <summary
        className="inline-flex h-8 shrink-0 cursor-pointer list-none items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-fin-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 [&::-webkit-details-marker]:hidden"
        aria-label={t('ledger.exportPdf')}
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-slate-500">
          <path d="M5 3a1 1 0 00-1 1v3H3a1 1 0 00-1 1v5a1 1 0 001 1h1v2a1 1 0 001 1h10a1 1 0 001-1v-2h1a1 1 0 001-1V8a1 1 0 00-1-1h-1V4a1 1 0 00-1-1H5zm10 4V4H5v3h10zM5 15v-2h10v2H5z" />
        </svg>
        {t('ledger.exportPdf')}
      </summary>

      <div className="absolute right-0 z-30 mt-1 w-72 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg">
        <button type="button" onClick={() => choose('statement')} className={item}>
          <span className="text-fin-md font-medium text-slate-900">{t('print.modeStatement')}</span>
          <span className="text-fin-xs leading-snug text-slate-500">
            {t('print.modeStatementHint')}
          </span>
        </button>

        <button type="button" onClick={() => choose('act')} className={item}>
          <span className="text-fin-md font-medium text-slate-900">{t('print.modeAct')}</span>
          <span className="text-fin-xs leading-snug text-slate-500">{t('print.modeActHint')}</span>
        </button>

        <label className="mt-1 flex cursor-pointer items-center gap-2 border-t border-slate-100 px-2 pb-1 pt-2 text-fin-sm text-slate-600">
          <input
            type="checkbox"
            checked={withAnalytics}
            onChange={(e) => onWithAnalyticsChange(e.target.checked)}
            className="h-3.5 w-3.5 accent-slate-900"
          />
          {t('print.withAnalytics')}
        </label>
      </div>
    </details>
  );
}
