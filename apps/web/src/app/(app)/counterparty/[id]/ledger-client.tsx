'use client';

import { useState } from 'react';
import { useTransactions } from '@mubosher/api-client';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { LedgerTable } from '@/components/LedgerTable';
import { LedgerAnalytics } from '@/components/LedgerAnalytics';
import { useLocale } from '@/lib/i18n/LocaleProvider';

export function CounterpartyLedgerClient({
  orgId,
  counterpartyId,
  counterpartyName,
}: {
  orgId: string;
  counterpartyId: string;
  counterpartyName: string;
}) {
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const { data: transactions, isLoading, error } = useTransactions(supabase, orgId, counterpartyId);
  const { t } = useLocale();
  const [printWithAnalytics, setPrintWithAnalytics] = useState(false);

  function handlePrintClick() {
    const includeAnalytics = window.confirm(t('ledger.includeAnalyticsInPdf'));
    setPrintWithAnalytics(includeAnalytics);
    // Let the analytics section's visibility update before the print dialog opens.
    requestAnimationFrame(() => window.print());
  }

  return (
    <div className="flex flex-col gap-6">
      <LedgerAnalytics transactions={transactions ?? []} forcePrintVisible={printWithAnalytics} />

      <LedgerTable
        supabase={supabase}
        orgId={orgId}
        counterpartyId={counterpartyId}
        counterpartyName={counterpartyName}
        transactions={transactions}
        isLoading={isLoading}
        error={error}
        onPrintClick={handlePrintClick}
      />
    </div>
  );
}
