'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTransactions } from '@mubosher/api-client';
import { buildStatement } from '@mubosher/shared';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { ArchiveCounterparty } from '@/components/ArchiveCounterparty';
import { CounterpartySettings } from '@/components/CounterpartySettings';
import { LedgerTable } from '@/components/LedgerTable';
import { LedgerAnalytics } from '@/components/LedgerAnalytics';
import { PrintHeader, PrintSignatures } from '@/components/PrintHeader';
import { PrintMenu, type PrintMode } from '@/components/PrintMenu';
import { ReconciliationAct } from '@/components/ReconciliationAct';
import { ALL_TIME_RANGE, formatPeriodLabel, usePeriodFilter } from '@/components/PeriodFilter';
import { analyticsFromTransactions } from '@/lib/analyticsData';
import { hasStashedDraft, useLedgerMode } from '@/lib/prefs/useLedgerMode';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Segmented } from '@/components/ui/Segmented';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { agingFromStatement } from '@/components/AgingLadder';

export function CounterpartyLedgerClient({
  orgId,
  orgName,
  counterpartyId,
  counterpartyName,
  baseCurrency = 'UZS',
  canWrite,
  archivedAt = null,
  details,
}: {
  orgId: string;
  orgName: string | null;
  counterpartyId: string;
  counterpartyName: string;
  baseCurrency?: string;
  /** Owner or admin. A manager reads the page and has no second mode at all. */
  canWrite: boolean;
  /** Set means the client has been put away already (0036). */
  archivedAt?: string | null;
  /** The client's own record, edited in the card above the ledger. */
  details: {
    name: string;
    phone?: string | null;
    currency?: string | null;
    managerId?: string | null;
    notes?: string | null;
    categories?: string[];
  };
}) {
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const { data: transactions, isLoading, error } = useTransactions(supabase, orgId, counterpartyId);
  const { t, locale } = useLocale();
  const dateLocale = locale === 'ru' ? 'ru-RU' : 'uz-UZ';
  const [printWithAnalytics, setPrintWithAnalytics] = useState(false);
  const [printMode, setPrintMode] = useState<PrintMode>('statement');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const period = usePeriodFilter('all');

  // One switch for the whole page: the settings form above and the ledger
  // below answer to it together, because "I am only reading" is a statement
  // about the visit, not about one card on it.
  const { mode, setMode } = useLedgerMode();
  const canEdit = canWrite && mode === 'edit';

  // A half-typed row survives being switched away from — it lives in storage,
  // not in the entry row — but vanishing without a word is how it gets
  // forgotten.
  const [stashedDraft, setStashedDraft] = useState(false);
  useEffect(() => {
    setStashedDraft(canWrite && !canEdit && hasStashedDraft(counterpartyId));
  }, [canWrite, canEdit, counterpartyId]);

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
    <div className="flex flex-col gap-4">
      {/* Above everything it governs, and the first thing on the page after
          the client's name — switching stance should not mean hunting for the
          switch. */}
      {canWrite && (
        <div className="no-print flex flex-wrap items-center gap-3">
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: 'view', label: t('ledger.modeView') },
              {
                value: 'edit',
                label: t('ledger.modeEdit'),
                // Not a white chip like every other segment: this one says the
                // page can be changed now, and that should be the most
                // definite thing on it.
                activeClassName: 'bg-slate-900 text-white shadow-card',
              },
            ]}
          />
          <span className="text-fin-sm text-slate-500">
            {canEdit ? t('ledger.modeEditHint') : t('ledger.modeViewHint')}
          </span>
          {stashedDraft && (
            <button
              type="button"
              onClick={() => setMode('edit')}
              className="text-fin-sm font-medium text-amber-700 underline-offset-2 hover:underline"
            >
              {t('ledger.draftStashed')}
            </button>
          )}
        </div>
      )}

      {/* The client's record, behind a button rather than spread across a form
          at the top of the page. It changes a few times a year; the ledger
          under it is why anyone opened this page. The line beside the button
          carries the part that gets looked up without opening anything. */}
      <div className="no-print flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" size="sm" onClick={() => setDetailsOpen(true)}>
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-slate-500">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          {t('counterparty.detailsTitle')}
        </Button>
        <span className="min-w-0 truncate text-fin-sm text-slate-500">
          {[details.phone, details.currency ?? baseCurrency, details.categories?.join(', ')]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </div>

      {detailsOpen && (
        <Modal
          onClose={() => setDetailsOpen(false)}
          title={t('counterparty.detailsTitle')}
          description={counterpartyName}
          width="xl"
        >
          <CounterpartySettings
            orgId={orgId}
            counterpartyId={counterpartyId}
            canWrite={canEdit}
            initial={details}
            onSaved={() => setDetailsOpen(false)}
          />
        </Modal>
      )}

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

      <LedgerAnalytics
        data={analytics}
        period={period}
        forcePrintVisible={printWithAnalytics}
        aging={agingFromStatement(statement)}
      />

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
        canEdit={canEdit}
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

      {/* Below the ledger, deliberately: putting a client away is the last
          thing on the page and never the first thing the eye lands on — and it
          is not offered at all to a visit that came to read. A client already
          archived is the exception: that card is how they are brought back,
          and hiding it would strand them behind a mode switch. */}
      {canWrite && (canEdit || archivedAt) && (
        <div className="mt-2">
          <ArchiveCounterparty
            orgId={orgId}
            counterpartyId={counterpartyId}
            counterpartyName={counterpartyName}
            archivedAt={archivedAt}
          />
        </div>
      )}
    </div>
  );
}
