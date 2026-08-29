'use client';

import { useMemo, useState } from 'react';
import { useTransactions } from '@mubosher/api-client';
import { buildStatement } from '@mubosher/shared';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { LedgerTable } from '@/components/LedgerTable';
import { LedgerAnalytics } from '@/components/LedgerAnalytics';
import { PrintHeader, PrintSignatures } from '@/components/PrintHeader';
import { PrintMenu, type PrintMode } from '@/components/PrintMenu';
import { ReconciliationAct } from '@/components/ReconciliationAct';
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
  const dateLocale = locale === 'ru' ? 'ru-RU' : 'uz-UZ';
  const [printWithAnalytics, setPrintWithAnalytics] = useState(false);
  const [printMode, setPrintMode] = useState<PrintMode>('statement');
  const period = usePeriodFilter('all');

  // Computed once here and handed down. The table, the reconciliation act and
  // the Excel export all render this same object, which is what stops any two
  // of them stating a different balance for the same client.
  const statement = useMemo(
    () => buildStatement(transactions ?? [], { range: period.range }),
    [transactions, period.range],
  );

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

  const periodLabel = formatPeriodLabel(period.range, dateLocale, t('export.periodAll'));

  function handlePrint(mode: PrintMode) {
    setPrintMode(mode);
    // Let the chosen document's visibility settle before the dialog opens.
    requestAnimationFrame(() => window.print());
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Two documents, one page. The act carries its own heading, parties and
          period, so the statement header stands down when it is the one being
          printed. */}
      {printMode === 'act' ? (
        <ReconciliationAct
          orgName={orgName}
          counterpartyName={counterpartyName}
          statement={statement}
          baseCurrency={baseCurrency}
          periodLabel={periodLabel}
        />
      ) : (
        <PrintHeader
          title={counterpartyName}
          subtitle={orgName}
          baseCurrency={baseCurrency}
          period={periodLabel}
        />
      )}

      <LedgerAnalytics data={analytics} period={period} forcePrintVisible={printWithAnalytics} />

      <LedgerTable
        supabase={supabase}
        orgId={orgId}
        counterpartyId={counterpartyId}
        counterpartyName={counterpartyName}
        transactions={transactions}
        statement={statement}
        isLoading={isLoading}
        error={error}
        period={period}
        orgName={orgName}
        baseCurrency={baseCurrency}
        summaryPrintable={printMode === 'statement'}
        printMenu={
          <PrintMenu
            withAnalytics={printWithAnalytics}
            onWithAnalyticsChange={setPrintWithAnalytics}
            onPrint={handlePrint}
          />
        }
      />

      <PrintSignatures counterpartyName={counterpartyName} />
    </div>
  );
}
