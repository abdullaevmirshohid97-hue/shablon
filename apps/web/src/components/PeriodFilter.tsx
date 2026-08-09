'use client';

import { useMemo, useState } from 'react';
import { getPeriodRange, type PeriodKind, type PeriodRange } from '@mubosher/shared';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Input } from '@/components/ui/Input';
import { Segmented } from '@/components/ui/Segmented';

/** `all` is the report-specific extra: no filtering, the whole history. */
export type ReportPeriodKind = 'all' | PeriodKind;

/**
 * Covers every possible ISO date, so "all time" can reuse the same
 * range-filtering code path instead of every consumer branching on null.
 */
export const ALL_TIME_RANGE: PeriodRange = { start: '0000-01-01', end: '9999-12-31' };

export interface PeriodFilterState {
  kind: ReportPeriodKind;
  setKind: (kind: ReportPeriodKind) => void;
  customStart: string;
  setCustomStart: (value: string) => void;
  customEnd: string;
  setCustomEnd: (value: string) => void;
  /** null = no restriction (either "all", or "custom" with an incomplete range). */
  range: PeriodRange | null;
}

/**
 * Period state for the reporting screens. Kept as a hook + presentational
 * component pair so the same selection drives what is on screen, what gets
 * printed, and what lands in the Excel file — a manager exporting "this
 * quarter" must get exactly the rows they were looking at.
 */
export function usePeriodFilter(initialKind: ReportPeriodKind = 'all'): PeriodFilterState {
  const [kind, setKind] = useState<ReportPeriodKind>(initialKind);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const today = useMemo(() => new Date(), []);

  const range = useMemo(() => {
    if (kind === 'all') return null;
    if (kind === 'custom') {
      if (!customStart || !customEnd) return null;
      return getPeriodRange('custom', today, { start: customStart, end: customEnd });
    }
    return getPeriodRange(kind, today);
  }, [kind, customStart, customEnd, today]);

  return { kind, setKind, customStart, setCustomStart, customEnd, setCustomEnd, range };
}

export function PeriodFilter({
  state,
  className = '',
}: {
  state: PeriodFilterState;
  className?: string;
}) {
  const { t } = useLocale();

  return (
    <div className={`no-print flex max-w-full flex-wrap items-center gap-2 ${className}`}>
      {/* Five options don't fit a phone's width — let the strip scroll on its
          own rather than pushing the page into a horizontal scroll. */}
      <Segmented
        className="max-w-full shrink-0 overflow-x-auto"
        value={state.kind}
        onChange={state.setKind}
        options={[
          { value: 'all', label: t('export.periodAll') },
          { value: 'month', label: t('analytics.month') },
          { value: 'quarter', label: t('analytics.quarter') },
          { value: 'year', label: t('analytics.year') },
          { value: 'custom', label: t('analytics.custom') },
        ]}
      />

      {state.kind === 'custom' && (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            aria-label={t('analytics.from')}
            value={state.customStart}
            onChange={(e) => state.setCustomStart(e.target.value)}
            className="w-auto"
          />
          <span className="text-fin-sm text-slate-400">—</span>
          <Input
            type="date"
            aria-label={t('analytics.to')}
            value={state.customEnd}
            onChange={(e) => state.setCustomEnd(e.target.value)}
            className="w-auto"
          />
        </div>
      )}
    </div>
  );
}

/** Human-readable period label for print headers and on-screen captions. */
export function formatPeriodLabel(
  range: PeriodRange | null,
  dateLocale: string,
  allLabel: string,
): string {
  if (!range) return allLabel;
  return `${new Date(range.start).toLocaleDateString(dateLocale)} — ${new Date(
    range.end,
  ).toLocaleDateString(dateLocale)}`;
}
