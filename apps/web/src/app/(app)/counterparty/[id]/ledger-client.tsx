'use client';

import { useMemo, useState } from 'react';
import { useTransactions } from '@mubosher/api-client';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { LedgerTable } from '@/components/LedgerTable';
import { LedgerAnalytics } from '@/components/LedgerAnalytics';
import { PrintHeader, PrintSignatures } from '@/components/PrintHeader';
import { ALL_TIME_RANGE, formatPeriodLabel, usePeriodFilter } from '@/components/PeriodFilter';
import { analyticsFromTransactions } from '@/lib/analyticsData';
import { useLocale } from '@/lib/i18n/LocaleProvider';

export function CounterpartyLedgerClient({
  orgId,
  orgName,
  counterpartyId,
  counterpartyName,
  baseCurrency = 'UZS',
}: {
  orgId: string;
  orgName: string | null;
  counterpartyId: string;
  counterpartyName: string;
  baseCurrency?: string;
}) {
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const { data: transactions, isLoading, error } = useTransactions(supabase, orgId, counterpartyId);
  const { t, locale } = useLocale();
  const [printWithAnalytics, setPrintWithAnalytics] = useState(false);
  const period = usePeriodFilter('all');

  // One client's rows are already loaded to draw the journal, so aggregating
  // them here costs nothing and keeps the figures consistent with the running
  // balance shown beside them.
  const analytics = useMemo(
    () =>
      analyticsFromTransactions(
        transactions ?? [],
        [{ id: counterpartyId, name: counterpartyName }],
        period.range ?? ALL_TIME_RANGE,
        new Date(),
      ),
    [transactions, counterpartyId, counterpartyName, period.range],
  );

  function handlePrintClick() {
    const includeAnalytics = window.confirm(t('ledger.includeAnalyticsInPdf'));
    setPrintWithAnalytics(includeAnalytics);
    // Let the analytics section's visibility update before the print dialog opens.
    requestAnimationFrame(() => window.print());
  }

  return (
    <div className="flex flex-col gap-6">
      <PrintHeader
        title={counterpartyName}
        subtitle={orgName}
        baseCurrency={baseCurrency}
        period={formatPeriodLabel(
          period.range,
          locale === 'ru' ? 'ru-RU' : 'uz-UZ',
          t('export.periodAll'),
        )}
      />

      <LedgerAnalytics data={analytics} period={period} forcePrintVisible={printWithAnalytics} />

      <LedgerTable
        supabase={supabase}
        orgId={orgId}
        counterpartyId={counterpartyId}
        counterpartyName={counterpartyName}
        transactions={transactions}
        isLoading={isLoading}
        error={error}
        onPrintClick={handlePrintClick}
        period={period}
        orgName={orgName}
        baseCurrency={baseCurrency}
      />

      <PrintSignatures counterpartyName={counterpartyName} />
    </div>
  );
}
