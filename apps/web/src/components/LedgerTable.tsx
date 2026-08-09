'use client';

import { useEffect, useMemo, useState } from 'react';
import { useCategoriesWithKind, useCreateTransaction } from '@mubosher/api-client';
import { computeRunningBalance } from '@mubosher/shared';
import type { FundSource, LedgerTransaction } from '@mubosher/shared';
import { EditTransactionModal } from './EditTransactionModal';
import { ReverseTransactionModal } from './ReverseTransactionModal';
import { PeriodFilter, type PeriodFilterState } from './PeriodFilter';
import { exportLedgerToExcel } from '@/lib/export/ledgerExcel';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { useOrgRole } from '@/lib/auth/OrgRoleProvider';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@mubosher/api-client';

const currencyFormatter = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2 });

// Column headings used to be 10px uppercase in the lightest grey on the ramp —
// legible on a designer's monitor, not on a laptop at arm's length. They now
// ride the Finance type scale like everything else and sit on the secondary
// ink, not the placeholder ink.
const th = 'px-3 py-2.5 text-fin-xs font-semibold uppercase tracking-[0.04em] text-slate-500';
const td = 'px-3 py-2.5 text-fin';
const inlineInput =
  'h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-fin text-slate-900 transition-colors hover:border-slate-400';

function dueDateTone(
  dueDate: string | null | undefined,
  todayIso: string,
): 'neutral' | 'warning' | 'danger' | null {
  if (!dueDate) return null;
  if (dueDate < todayIso) return 'danger';
  const horizon = new Date(todayIso);
  horizon.setDate(horizon.getDate() + 7);
  if (dueDate <= horizon.toISOString().slice(0, 10)) return 'warning';
  return 'neutral';
}

/** Hozirgi mahalliy sana-vaqt (yyyy-MM-ddTHH:mm) — datetime-local input uchun. */
function nowLocalDatetime(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function emptyDraft() {
  return {
    // Avtomatik hozirgi sana + soat:daqiqa; foydalanuvchi qo'lda o'zgartira oladi.
    occurredAt: nowLocalDatetime(),
    description: '',
    kg: '',
    dona: '',
    chiqimSumma: '',
    kirimSumma: '',
    dueDate: '',
    source: 'fabrika' as FundSource,
    currency: 'UZS',
  };
}

type Draft = ReturnType<typeof emptyDraft>;

/** Half-typed rows live here, per client, until they are saved or cleared. */
const draftStorageKey = (counterpartyId: string) => `mubosher.ledgerDraft.${counterpartyId}`;

/**
 * The date, the currency and the fund source are always populated, so they say
 * nothing about whether the user has actually started typing. Only the fields
 * they fill by hand count as work worth protecting.
 */
function hasTypedContent(draft: Draft) {
  return Boolean(
    draft.description ||
    draft.kg ||
    draft.dona ||
    draft.chiqimSumma ||
    draft.kirimSumma ||
    draft.dueDate,
  );
}

function InlineEntryRow({
  supabase,
  orgId,
  counterpartyId,
  currencies,
  columnCount,
}: {
  supabase: SupabaseClient<Database>;
  orgId: string;
  counterpartyId: string;
  currencies: string[];
  columnCount: number;
}) {
  const { t } = useLocale();
  const { data: categories } = useCategoriesWithKind(supabase, orgId);
  const createTransaction = useCreateTransaction(supabase);
  const [draft, setDraft] = useState(emptyDraft());
  const [formError, setFormError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const storageKey = draftStorageKey(counterpartyId);
  const isDirty = hasTypedContent(draft);

  // A half-filled row survives leaving the page. Switching to the warehouse
  // module mid-entry — or closing the tab by accident — used to throw the
  // typing away silently, because the row only existed in React state.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (!stored) return;
      const parsed = { ...emptyDraft(), ...(JSON.parse(stored) as Partial<Draft>) };
      if (!hasTypedContent(parsed)) return;
      setDraft(parsed);
      setRestored(true);
    } catch {
      // Corrupted or unavailable storage is not worth a broken ledger.
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      if (isDirty) window.localStorage.setItem(storageKey, JSON.stringify(draft));
      else window.localStorage.removeItem(storageKey);
    } catch {
      // Storage disabled: the row still works, it just won't outlive the page.
    }
  }, [draft, isDirty, storageKey]);

  // Closing the tab or hitting reload is the one exit the restore above cannot
  // cover reliably, so it gets the browser's own confirmation.
  useEffect(() => {
    if (!isDirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setRestored(false);
    setFormError(null);
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function discardDraft() {
    setDraft(emptyDraft());
    setRestored(false);
    setFormError(null);
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      /* nothing to clean up */
    }
  }

  // No mutual-exclusivity restrictions: kg and dona, kirim and chiqim can
  // all be filled together. Each filled amount becomes its own posting (a
  // row can carry both a kirim and a chiqim leg); kg and dona are stored in
  // their own dedicated columns so both stay visible in the ledger's Kg/Dona
  // columns instead of being folded into the description text.
  async function handleSave() {
    setFormError(null);
    setRestored(false);

    const hasKirim = draft.kirimSumma !== '';
    const hasChiqim = draft.chiqimSumma !== '';
    if (!hasKirim && !hasChiqim) {
      setFormError(t('ledger.inlineAmountRequired'));
      return;
    }

    const quantityKg = draft.kg !== '' ? Number(draft.kg) : undefined;
    const quantityDona = draft.dona !== '' ? Number(draft.dona) : undefined;
    const description = draft.description || undefined;

    const legs: Array<{ kind: 'kirim' | 'chiqim'; amount: number }> = [
      ...(hasKirim ? [{ kind: 'kirim' as const, amount: Number(draft.kirimSumma) }] : []),
      ...(hasChiqim ? [{ kind: 'chiqim' as const, amount: Number(draft.chiqimSumma) }] : []),
    ];

    // A failed leg must not clear the row: whatever was typed stays on screen
    // (and in storage) so it can be retried, rather than vanishing along with
    // the error that caused it.
    try {
      for (const leg of legs) {
        const category = (categories ?? []).find((c) => c.kind === leg.kind);
        if (!category) {
          setFormError(t('ledger.inlineNoCategoryError'));
          return;
        }

        await createTransaction.mutateAsync({
          orgId,
          counterpartyId,
          categoryId: category.id,
          occurredAt: new Date(draft.occurredAt).toISOString(),
          dueDate: leg.kind === 'chiqim' && draft.dueDate ? draft.dueDate : undefined,
          description,
          quantityKg,
          quantityDona,
          amount: leg.amount,
          currency: draft.currency,
          source: draft.source,
          clientLocalId: crypto.randomUUID(),
        });
      }
    } catch (err) {
      setFormError((err as Error).message);
      return;
    }

    discardDraft();
  }

  return (
    <>
      <tr className="border-b border-slate-200 bg-slate-100/70 no-print">
        <td className="px-2 py-1.5">
          <input
            type="datetime-local"
            value={draft.occurredAt}
            onChange={(e) => set('occurredAt', e.target.value)}
            className={inlineInput}
          />
        </td>
        <td className="px-2 py-1.5 text-center text-fin-xs text-slate-500">{t('ledger.auto')}</td>
        {/* Valyuta belongs with the figures it denominates, not down in the
            note field where it had ended up sitting on top of the comment.
            Anything other than the base currency is converted at the rate in
            force on the entry's own date — see Settings > Kurslar. */}
        <td className="px-2 py-1.5">
          <select
            value={draft.currency}
            onChange={(e) => set('currency', e.target.value)}
            aria-label={t('rates.currency')}
            title={t('rates.currency')}
            className={inlineInput}
          >
            {currencies.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </td>
        <td className="px-2 py-1.5">
          <input
            type="number"
            value={draft.kg}
            onChange={(e) => set('kg', e.target.value)}
            className={`${inlineInput} text-right tabular-nums`}
          />
        </td>
        <td className="px-2 py-1.5">
          <input
            type="number"
            value={draft.dona}
            onChange={(e) => set('dona', e.target.value)}
            className={`${inlineInput} text-right tabular-nums`}
          />
        </td>
        <td className="px-2 py-1.5">
          <input
            type="number"
            value={draft.chiqimSumma}
            onChange={(e) => set('chiqimSumma', e.target.value)}
            className={`${inlineInput} text-right tabular-nums`}
          />
        </td>
        <td className="px-2 py-1.5">
          <input
            type="number"
            value={draft.kirimSumma}
            onChange={(e) => set('kirimSumma', e.target.value)}
            className={`${inlineInput} text-right tabular-nums`}
          />
        </td>
        <td className="px-2 py-1.5">
          <input
            type="date"
            value={draft.dueDate}
            onChange={(e) => set('dueDate', e.target.value)}
            disabled={draft.chiqimSumma === ''}
            className={`${inlineInput} disabled:bg-slate-100 disabled:text-slate-300`}
          />
        </td>
        {/* Joriy saldo — yangi qator saqlangach hisoblanadi, bu yerda bo'sh */}
        <td className="px-2 py-1.5 text-center text-fin-xs text-slate-400">—</td>
        <td className="px-1 py-1.5">
          <button
            type="button"
            onClick={handleSave}
            disabled={createTransaction.isPending}
            title={t('common.save')}
            aria-label={t('common.save')}
            className="flex h-8 w-full items-center justify-center rounded-md bg-slate-900 text-white transition-colors hover:bg-slate-800 disabled:opacity-45"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path
                fillRule="evenodd"
                d="M16.704 5.29a1 1 0 010 1.415l-7.5 7.5a1 1 0 01-1.415 0l-3.5-3.5a1 1 0 111.415-1.414L8.5 12.086l6.79-6.795a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </td>
      </tr>
      {/* Izoh — the last step, not a column. It gets the full width of the
          table on its own line, below the figures it describes: you fill the
          row, then say what it was. */}
      <tr className="border-b border-slate-200 bg-slate-100/70 no-print">
        <td colSpan={columnCount} className="px-2 pb-2">
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex min-w-[240px] flex-1 items-center gap-2">
              <span className="shrink-0 text-fin-xs font-medium uppercase tracking-[0.04em] text-slate-500">
                {t('transaction.description')}
              </span>
              <input
                type="text"
                value={draft.description}
                onChange={(e) => set('description', e.target.value)}
                placeholder={t('ledger.inlineDescriptionHint')}
                className={`${inlineInput} flex-1`}
              />
            </label>

            {/* Whatever is in the row right now, and what became of it. Three
                states share this slot so the toolbar never grows a permanent
                strip of chrome for a transient message. */}
            {(formError || restored || isDirty) && (
              <div className="flex items-center gap-2">
                {formError ? (
                  <span className="text-fin-sm font-medium text-rose-600">{formError}</span>
                ) : restored ? (
                  <span className="text-fin-sm text-amber-700">{t('ledger.draftRestored')}</span>
                ) : (
                  <span className="text-fin-sm text-slate-500">{t('ledger.draftUnsaved')}</span>
                )}
                {isDirty && (
                  <button
                    type="button"
                    onClick={discardDraft}
                    className="shrink-0 text-fin-sm font-medium text-slate-500 underline-offset-2 hover:text-slate-900 hover:underline"
                  >
                    {t('ledger.draftClear')}
                  </button>
                )}
              </div>
            )}
          </div>
        </td>
      </tr>
    </>
  );
}

export function LedgerTable({
  supabase,
  orgId,
  counterpartyId,
  counterpartyName,
  transactions,
  isLoading,
  error,
  onPrintClick,
  period,
}: {
  supabase: SupabaseClient<Database>;
  orgId: string;
  counterpartyId: string;
  counterpartyName: string;
  transactions: LedgerTransaction[] | undefined;
  isLoading: boolean;
  error: unknown;
  onPrintClick?: () => void;
  /** Owned by the page so the same period drives the table, the print header and the export. */
  period: PeriodFilterState;
}) {
  const [currencies, setCurrencies] = useState<string[]>(['UZS']);
  const [editing, setEditing] = useState<LedgerTransaction | null>(null);
  const [reversing, setReversing] = useState<LedgerTransaction | null>(null);
  const { locale, t } = useLocale();
  const { canWrite } = useOrgRole();
  const dateLocale = locale === 'ru' ? 'ru-RU' : 'uz-UZ';
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  useEffect(() => {
    if (!canWrite) return;
    supabase
      .from('currencies')
      .select('code')
      .order('code')
      .then(({ data }) => {
        if (data?.length) setCurrencies(data.map((c) => c.code));
      });
  }, [supabase, canWrite]);

  // Managers get the ledger without the entry row and without the edit
  // column, so the table is one column narrower for them.
  const columnCount = canWrite ? 10 : 9;

  // Newest first, matching how the paper ledger and Excel export read.
  // The period only narrows what is *shown*; the balance below is still
  // accumulated over the full history, so a filtered row keeps the correct
  // carried-in saldo instead of restarting from zero.
  const displayRows = useMemo(() => {
    if (!transactions) return [];
    const range = period.range;
    const rows = range
      ? transactions.filter((t) => {
          const date = t.occurredAt.slice(0, 10);
          return date >= range.start && date <= range.end;
        })
      : transactions;
    return [...rows].reverse();
  }, [transactions, period.range]);

  // Joriy saldo (running balance) per row — computed in chronological order,
  // then looked up by id while rendering the reversed (newest-first) view.
  const balanceById = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeRunningBalance>[number]>();
    if (transactions) {
      for (const entry of computeRunningBalance(transactions)) map.set(entry.transactionId, entry);
    }
    return map;
  }, [transactions]);

  if (isLoading) return <p className="text-fin text-slate-500">{t('common.loading')}</p>;
  if (error)
    return (
      <p className="text-fin text-rose-600">
        {t('common.error')}: {(error as Error).message}
      </p>
    );

  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="no-print flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <PeriodFilter state={period} />
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() =>
              transactions &&
              exportLedgerToExcel(counterpartyName, transactions, locale, period.range)
            }
            disabled={!displayRows.length}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-emerald-600">
              <path d="M4 3a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1V4a1 1 0 00-1-1H4zm2.5 3.5h1.2l1.05 2.1L9.8 6.5H11l-1.75 3 1.85 3.2H9.9l-1.15-2.2-1.15 2.2H6.4l1.85-3.2L6.5 6.5z" />
            </svg>
            {t('ledger.exportExcel')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => (onPrintClick ? onPrintClick() : window.print())}
            disabled={!displayRows.length}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-slate-500">
              <path d="M5 3a1 1 0 00-1 1v3H3a1 1 0 00-1 1v5a1 1 0 001 1h1v2a1 1 0 001 1h10a1 1 0 001-1v-2h1a1 1 0 001-1V8a1 1 0 00-1-1h-1V4a1 1 0 00-1-1H5zm10 4V4H5v3h10zM5 15v-2h10v2H5z" />
            </svg>
            {t('ledger.exportPdf')}
          </Button>
        </div>
      </div>

      <div className="ledger-scroll max-h-[65vh] overflow-auto">
        <table className="w-full min-w-[1060px] table-fixed border-collapse text-fin">
          <colgroup>
            <col className="w-[12%]" />
            <col className="w-[8%]" />
            <col className="w-[15%]" />
            <col className="w-[7%]" />
            <col className="w-[7%]" />
            <col className="w-[12%]" />
            <col className="w-[12%]" />
            <col className="w-[9%]" />
            <col className="w-[10%]" />
            {canWrite && <col className="w-[8%] print:hidden" />}
          </colgroup>
          <thead className="sticky top-0 z-10 bg-white">
            <tr className="border-b border-slate-300 text-left">
              <th className={th}>{t('ledger.date')}</th>
              <th className={th}>{t('ledger.documentNo')}</th>
              <th className={th}>{t('ledger.process')}</th>
              <th className={`${th} text-right`}>{t('ledger.kg')}</th>
              <th className={`${th} text-right`}>{t('ledger.dona')}</th>
              <th className={`${th} text-right`}>{t('ledger.chiqimSumma')}</th>
              <th className={`${th} text-right`}>{t('ledger.kirimSumma')}</th>
              <th className={th}>{t('ledger.chiqimMuddati')}</th>
              <th className={`${th} text-right`}>{t('ledger.balance')}</th>
              {canWrite && <th className="print:hidden" />}
            </tr>
          </thead>
          <tbody>
            {canWrite && (
              <InlineEntryRow
                supabase={supabase}
                orgId={orgId}
                counterpartyId={counterpartyId}
                currencies={currencies}
                columnCount={columnCount}
              />
            )}
            {displayRows.map((tx) => {
              const isChiqim = tx.creditAccountType === 'receivable';
              const tone = isChiqim ? dueDateTone(tx.dueDate, todayIso) : null;
              const kg = tx.quantityKg ?? (tx.unit === 'kg' ? tx.quantity : null);
              const dona = tx.quantityDona ?? (tx.unit === 'dona' ? tx.quantity : null);
              const isReversed = tx.status === 'reversed';
              const isReversal = tx.status === 'reversal';
              return (
                <tr
                  key={tx.id}
                  // Alternating bands rather than a rule under every row: at
                  // ten columns of figures the eye loses its line halfway
                  // across, and a band carries it further than a hairline.
                  className={`border-b border-slate-200 transition-colors even:bg-slate-50/70 hover:bg-slate-100 ${
                    isReversed ? 'text-slate-400 line-through' : ''
                  } ${isReversal ? 'bg-amber-50/50' : ''}`}
                >
                  <td className={`${td} text-slate-700 tabular-nums`}>
                    <div>{new Date(tx.occurredAt).toLocaleDateString(dateLocale)}</div>
                    <div className="text-fin-xs text-slate-500">
                      {new Date(tx.occurredAt).toLocaleTimeString(dateLocale, {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </td>
                  <td className={`${td} truncate text-slate-500 tabular-nums`}>{tx.documentNo}</td>
                  <td className={`${td} truncate`} title={tx.description ?? undefined}>
                    <span className={isReversed ? '' : 'text-slate-900'}>{tx.description}</span>
                    {(isReversed || isReversal) && (
                      <Badge
                        tone={isReversal ? 'warning' : 'neutral'}
                        className="ml-1.5 no-underline"
                      >
                        {t(isReversal ? 'ledger.statusReversal' : 'ledger.statusReversed')}
                      </Badge>
                    )}
                  </td>
                  <td className={`${td} text-right tabular-nums`}>{kg ?? ''}</td>
                  <td className={`${td} text-right tabular-nums`}>{dona ?? ''}</td>
                  <td className={`${td} text-right font-medium tabular-nums text-rose-600`}>
                    {isChiqim ? currencyFormatter.format(tx.creditAmount) : ''}
                  </td>
                  <td className={`${td} text-right font-medium tabular-nums text-emerald-600`}>
                    {tx.debitAccountType === 'receivable'
                      ? currencyFormatter.format(tx.debitAmount)
                      : ''}
                  </td>
                  <td className={`${td} truncate`}>
                    {isChiqim && tx.dueDate ? (
                      <Badge tone={tone ?? 'neutral'}>
                        {new Date(tx.dueDate).toLocaleDateString(dateLocale)}
                      </Badge>
                    ) : (
                      ''
                    )}
                  </td>
                  <td className={`${td} bg-slate-50/60 text-right font-semibold tabular-nums`}>
                    {(() => {
                      const bal = balanceById.get(tx.id);
                      if (!bal) return '';
                      const isCredit = bal.side === 'credit';
                      return (
                        <span
                          className={isCredit ? 'text-amber-600' : 'text-slate-900'}
                          title={isCredit ? t('ledger.weOwe') : t('ledger.owesUs')}
                        >
                          {isCredit ? '−' : ''}
                          {currencyFormatter.format(bal.balance)}
                        </span>
                      );
                    })()}
                  </td>
                  {canWrite && (
                    <td className="px-2 py-2.5 text-right print:hidden">
                      {/* A reversed entry and its mirror are both history now —
                          neither can be edited or reversed again. */}
                      {!isReversed && !isReversal && (
                        <div className="flex items-center justify-end gap-0.5">
                          <button
                            type="button"
                            onClick={() => setEditing(tx)}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            title={t('common.edit')}
                            aria-label={t('common.edit')}
                          >
                            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                              <path d="M13.586 3.586a2 2 0 112.828 2.828l-8.5 8.5a1 1 0 01-.464.263l-3 .75a.5.5 0 01-.606-.606l.75-3a1 1 0 01.263-.464l8.5-8.5z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => setReversing(tx)}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-700"
                            title={t('ledger.reverseTitle')}
                            aria-label={t('ledger.reverseTitle')}
                          >
                            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                              <path
                                fillRule="evenodd"
                                d="M7.793 2.293a1 1 0 011.414 1.414L6.914 6H12a5 5 0 010 10h-1a1 1 0 110-2h1a3 3 0 100-6H6.914l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            {!transactions?.length && (
              <tr>
                <td colSpan={columnCount} className="py-10 text-center text-fin text-slate-500">
                  {t('ledger.empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {reversing && canWrite && (
        <ReverseTransactionModal
          supabase={supabase}
          orgId={orgId}
          counterpartyId={counterpartyId}
          transaction={reversing}
          onClose={() => setReversing(null)}
        />
      )}

      {editing && canWrite && (
        <EditTransactionModal
          supabase={supabase}
          orgId={orgId}
          counterpartyId={counterpartyId}
          transaction={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </Card>
  );
}
