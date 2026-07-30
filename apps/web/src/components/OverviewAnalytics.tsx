'use client';

import { useMemo } from 'react';
import { useOrgOverview, useModules } from '@mubosher/api-client';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { exportOrgSummaryToExcel } from '@/lib/export/orgSummaryExcel';
import { LedgerAnalytics } from './LedgerAnalytics';
import { TopDebtors } from './TopDebtors';
import { ModuleBreakdownTable } from './ModuleBreakdownTable';
import { PrintHeader } from './PrintHeader';
import { formatPeriodLabel, PeriodFilter, usePeriodFilter } from './PeriodFilter';
import { Button } from '@/components/ui/Button';

/**
 * Drives the "at a glance" dashboard: the main overview (all clients) and
 * every module page (clients filtered by category) both render this same
 * component, just with a different `categoryFilter` — one data fetch
 * (`useOrgOverview`) that Next.js's client-side router cache keeps warm
 * across navigations between them. The main overview additionally shows a
 * per-module breakdown table (skipped on module pages — a module doesn't
 * need a table of itself).
 *
 * It is also the reporting surface: the same period selection feeds the
 * figures, the printed PDF and the multi-sheet Excel workbook, which is the
 * manager role's main tool now that Finance data entry is admin-only.
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
  const supabase = createSupabaseBrowserClient();
  const { data, isLoading, error } = useOrgOverview(supabase, orgId);
  const { data: modules } = useModules(supabase, categoryFilter ? undefined : orgId);
  const period = usePeriodFilter('all');

  const scoped = useMemo(() => {
    if (!data) return null;
    if (!categoryFilter) return data;

    const counterparties = data.counterparties.filter((c) =>
      c.categories?.includes(categoryFilter),
    );
    const ids = new Set(counterparties.map((c) => c.id));
    const transactions = data.transactions.filter((t) => ids.has(t.counterpartyId));
    return { counterparties, transactions };
  }, [data, categoryFilter]);

  const reportTitle = categoryFilter ?? orgName ?? t('nav.allClients');

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

  if (!scoped) return null;

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
            disabled={!scoped.counterparties.length}
            onClick={() =>
              exportOrgSummaryToExcel(
                reportTitle,
                scoped.counterparties,
                scoped.transactions,
                locale,
                period.range,
              )
            }
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-emerald-600">
              <path d="M4 3a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1V4a1 1 0 00-1-1H4zm2.5 3.5h1.2l1.05 2.1L9.8 6.5H11l-1.75 3 1.85 3.2H9.9l-1.15-2.2-1.15 2.2H6.4l1.85-3.2L6.5 6.5z" />
            </svg>
            {t('export.excelReport')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => window.print()}
            disabled={!scoped.counterparties.length}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-slate-500">
              <path d="M5 3a1 1 0 00-1 1v3H3a1 1 0 00-1 1v5a1 1 0 001 1h1v2a1 1 0 001 1h10a1 1 0 001-1v-2h1a1 1 0 001-1V8a1 1 0 00-1-1h-1V4a1 1 0 00-1-1H5zm10 4V4H5v3h10zM5 15v-2h10v2H5z" />
            </svg>
            {t('ledger.exportPdf')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <LedgerAnalytics
            transactions={scoped.transactions}
            counterparties={scoped.counterparties}
            period={period}
            // On the dashboard the analytics card *is* the report, so unlike
            // the per-client ledger it always goes into the printed PDF.
            forcePrintVisible
          />
        </div>
        <TopDebtors counterparties={scoped.counterparties} transactions={scoped.transactions} />
      </div>

      {!categoryFilter && modules && modules.length > 0 && (
        <ModuleBreakdownTable
          modules={modules}
          counterparties={scoped.counterparties}
          transactions={scoped.transactions}
        />
      )}
    </div>
  );
}
