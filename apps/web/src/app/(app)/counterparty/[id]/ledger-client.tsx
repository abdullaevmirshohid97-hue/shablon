'use client';

import { useState } from 'react';
import { useTransactions } from '@mubosher/api-client';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { LedgerTable } from '@/components/LedgerTable';
import { LedgerAnalytics } from '@/components/LedgerAnalytics';
import { PrintHeader } from '@/components/PrintHeader';
import { formatPeriodLabel, usePeriodFilter } from '@/components/PeriodFilter';
import { useLocale } from '@/lib/i18n/LocaleProvider';

export function CounterpartyLedgerClient({
  orgId,
  orgName,
  counterpartyId,
  counterpartyName,
}: {
  orgId: string;
  orgName: string | null;
  counterpartyId: string;
  counterpartyName: string;
}) {
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const { data: transactions, isLoading, error } = useTransactions(supabase, orgId, counterpartyId);
  const { t, locale } = useLocale();
  const [printWithAnalytics, setPrintWithAnalytics] = useState(false);
  const period = usePeriodFilter('all');

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
        period={formatPeriodLabel(
          period.range,
          locale === 'ru' ? 'ru-RU' : 'uz-UZ',
          t('export.periodAll'),
        )}
      />

      <LedgerAnalytics
        transactions={transactions ?? []}
        counterparties={[{ id: counterpartyId, name: counterpartyName }]}
        period={period}
        forcePrintVisible={printWithAnalytics}
      />

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
      />
    </div>
  );
}
