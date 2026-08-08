'use client';

import { useMemo, useState } from 'react';
import { useOrgReport, fetchOrgLedger, useCounterpartyJournal } from '@mubosher/api-client';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { exportOrgSummaryToExcel } from '@/lib/export/orgSummaryExcel';
import { analyticsFromReport } from '@/lib/analyticsData';
import { LedgerAnalytics } from './LedgerAnalytics';
import { TopDebtors } from './TopDebtors';
import { ModuleBreakdownTable } from './ModuleBreakdownTable';
import { CounterpartyJournal } from './CounterpartyJournal';
import { PrintHeader } from './PrintHeader';
import { formatPeriodLabel, PeriodFilter, usePeriodFilter } from './PeriodFilter';
import { Button } from '@/components/ui/Button';

/**
 * The "at a glance" dashboard: the main overview and every module page render
 * this same component with a different `categoryFilter`.
 *
 * Every figure here is aggregated in Postgres (`useOrgReport`). It used to
 * download the org's entire transaction table on each visit so the browser
 * could sum it — fine at a few hundred rows, unusable at fifty thousand.
 *
 * The Excel report is the one thing that still needs the underlying entries,
 * so it fetches them when the button is pressed rather than the page holding
 * them permanently for a file most visits never generate.
 */
export function OverviewAnalytics({
  orgId,
  orgName,
  categoryFilter,
}: {
  orgId: string;
  orgName?: string | null;
  categoryFilter?: string;
}) {
  const { t, locale } = useLocale();
  const dateLocale = locale === 'ru' ? 'ru-RU' : 'uz-UZ';
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const period = usePeriodFilter('all');

  const { data, isLoading, error } = useOrgReport(
    supabase,
    orgId,
    { from: period.range?.start ?? null, to: period.range?.end ?? null },
    categoryFilter,
  );

  // The debtors panel and the journal below read the same list, so the two
  // cannot show different figures for a client on one screen. Not period
  // scoped: a debt is a position and does not restart with the filter.
  const { data: journal } = useCounterpartyJournal(supabase, orgId);

  const [exporting, setExporting] = useState(false);
  const analytics = useMemo(() => (data ? analyticsFromReport(data) : null), [data]);
  const reportTitle = categoryFilter ?? orgName ?? t('nav.allClients');

  async function handleExcelReport() {
    setExporting(true);
    try {
      const ledger = await fetchOrgLedger(supabase, orgId, categoryFilter);
      exportOrgSummaryToExcel(
        reportTitle,
        ledger.counterparties,
        ledger.transactions,
        locale,
        period.range,
      );
    } finally {
      setExporting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="mb-6 h-40 animate-pulse rounded-xl border border-slate-200 bg-slate-50" />
    );
  }

  if (error) {
    return (
      <p className="mb-6 text-sm text-rose-600">
        {t('common.error')}: {(error as Error).message}
      </p>
    );
  }

  if (!data || !analytics) return null;

  return (
    <div className="mb-6 flex flex-col gap-4">
      <PrintHeader
        title={reportTitle}
        subtitle={categoryFilter ? orgName : null}
        period={formatPeriodLabel(period.range, dateLocale, t('export.periodAll'))}
      />

      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <PeriodFilter state={period} />
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={exporting}
            onClick={handleExcelReport}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-emerald-600">
              <path d="M4 3a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1V4a1 1 0 00-1-1H4zm2.5 3.5h1.2l1.05 2.1L9.8 6.5H11l-1.75 3 1.85 3.2H9.9l-1.15-2.2-1.15 2.2H6.4l1.85-3.2L6.5 6.5z" />
            </svg>
            {exporting ? t('common.loading') : t('export.excelReport')}
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => window.print()}>
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-slate-500">
              <path d="M5 3a1 1 0 00-1 1v3H3a1 1 0 00-1 1v5a1 1 0 001 1h1v2a1 1 0 001 1h10a1 1 0 001-1v-2h1a1 1 0 001-1V8a1 1 0 00-1-1h-1V4a1 1 0 00-1-1H5zm10 4V4H5v3h10zM5 15v-2h10v2H5z" />
            </svg>
            {t('ledger.exportPdf')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {/* On the dashboard the analytics card *is* the report, so unlike
              the per-client ledger it always goes into the printed PDF. */}
          <LedgerAnalytics data={analytics} period={period} forcePrintVisible />
        </div>
        <TopDebtors rows={journal ?? []} />
      </div>

      {/* The journal replaces the module table as the bottom of the page:
          the question asked here is which client owes what, and a per-module
          turnover row cannot answer it. The module table stays below it, and
          only when there is more than one module to compare. */}
      {!categoryFilter && <CounterpartyJournal orgId={orgId} />}

      {!categoryFilter && data.modules.length > 1 && (
        <ModuleBreakdownTable modules={data.modules} />
      )}
    </div>
  );
}
