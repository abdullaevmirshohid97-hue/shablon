'use client';

import { useMemo, useState } from 'react';
import { useCategoriesWithKind, useCreateTransaction } from '@mubosher/api-client';
import { computeRunningBalance } from '@mubosher/shared';
import type { FundSource, LedgerTransaction } from '@mubosher/shared';
import { EditTransactionModal } from './EditTransactionModal';
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

const th = 'px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500';
const inlineInput =
  'w-full rounded border border-slate-300 bg-white px-1.5 py-1 text-xs focus:border-brand-500';

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
  };
}

function InlineEntryRow({
  supabase,
  orgId,
  counterpartyId,
}: {
  supabase: SupabaseClient<Database>;
  orgId: string;
  counterpartyId: string;
}) {
  const { t } = useLocale();
  const { data: categories } = useCategoriesWithKind(supabase, orgId);
  const createTransaction = useCreateTransaction(supabase);
  const [draft, setDraft] = useState(emptyDraft());
  const [formError, setFormError] = useState<string | null>(null);

  function set<K extends keyof ReturnType<typeof emptyDraft>>(
    key: K,
    value: ReturnType<typeof emptyDraft>[K],
  ) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  // No mutual-exclusivity restrictions: kg and dona, kirim and chiqim can
  // all be filled together. Each filled amount becomes its own posting (a
  // row can carry both a kirim and a chiqim leg); kg and dona are stored in
  // their own dedicated columns so both stay visible in the ledger's Kg/Dona
  // columns instead of being folded into the description text.
  async function handleSave() {
    setFormError(null);

    const hasKirim = draft.kirimSumma !== '';
    const hasChiqim = draft.chiqimSumma !== '';
    if (!hasKirim && !hasChiqim) return;

    const quantityKg = draft.kg !== '' ? Number(draft.kg) : undefined;
    const quantityDona = draft.dona !== '' ? Number(draft.dona) : undefined;
    const description = draft.description || undefined;

    const legs: Array<{ kind: 'kirim' | 'chiqim'; amount: number }> = [
      ...(hasKirim ? [{ kind: 'kirim' as const, amount: Number(draft.kirimSumma) }] : []),
      ...(hasChiqim ? [{ kind: 'chiqim' as const, amount: Number(draft.chiqimSumma) }] : []),
    ];

    for (const leg of legs) {
      const category = (categories ?? []).find((c) => c.kind === leg.kind);
      if (!category) {
        setFormError(t('ledger.inlineNoCategoryError'));
        continue;
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
        currency: 'UZS',
        source: draft.source,
        clientLocalId: crypto.randomUUID(),
      });
    }

    setDraft(emptyDraft());
  }

  return (
    <>
      <tr className="border-b border-brand-100 bg-brand-50/30 no-print">
        <td className="px-2 py-1.5">
          <input
            type="datetime-local"
            value={draft.occurredAt}
            onChange={(e) => set('occurredAt', e.target.value)}
            className={inlineInput}
          />
        </td>
        <td className="px-2 py-1.5 text-center text-[10px] text-slate-400">{t('ledger.auto')}</td>
        <td className="px-2 py-1.5 text-[10px] leading-tight text-slate-400">
          ↓ {t('transaction.description')}
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
        <td className="px-2 py-1.5 text-center text-[10px] text-slate-300">—</td>
        <td className="px-1 py-1.5">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleSave}
              disabled={createTransaction.isPending}
              title={t('common.save')}
              className="rounded-md bg-brand-600 p-1.5 text-white hover:bg-brand-700 disabled:opacity-50"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path
                  fillRule="evenodd"
                  d="M16.704 5.29a1 1 0 010 1.415l-7.5 7.5a1 1 0 01-1.415 0l-3.5-3.5a1 1 0 111.415-1.414L8.5 12.086l6.79-6.795a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
          {(formError || createTransaction.isError) && (
            <p className="mt-1 whitespace-normal text-[10px] text-rose-600">
              {formError ?? (createTransaction.error as Error).message}
            </p>
          )}
        </td>
      </tr>
      {/* Izoh — alohida to'liq kenglikdagi qator, tor ustunda emas, bemalol yoziladi */}
      <tr className="border-b-2 border-brand-100 bg-brand-50/30 no-print">
        <td colSpan={10} className="px-2 pb-2">
          <input
            type="text"
            value={draft.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder={`${t('transaction.description')} (izoh)`}
            className={`${inlineInput} w-full`}
          />
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
  const [editing, setEditing] = useState<LedgerTransaction | null>(null);
  const { locale, t } = useLocale();
  const { canWrite } = useOrgRole();
  const dateLocale = locale === 'ru' ? 'ru-RU' : 'uz-UZ';
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

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

  if (isLoading) return <p className="text-sm text-slate-500">{t('common.loading')}</p>;
  if (error)
    return (
      <p className="text-sm text-rose-600">
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
        <table className="w-full min-w-[1060px] table-fixed border-collapse text-xs sm:text-sm">
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
          <thead className="sticky top-0 z-10 bg-slate-50">
            <tr className="border-b border-slate-200 text-left">
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
              <InlineEntryRow supabase={supabase} orgId={orgId} counterpartyId={counterpartyId} />
            )}
            {displayRows.map((tx) => {
              const isChiqim = tx.creditAccountType === 'receivable';
              const tone = isChiqim ? dueDateTone(tx.dueDate, todayIso) : null;
              const kg = tx.quantityKg ?? (tx.unit === 'kg' ? tx.quantity : null);
              const dona = tx.quantityDona ?? (tx.unit === 'dona' ? tx.quantity : null);
              return (
                <tr
                  key={tx.id}
                  className="border-b-2 border-slate-200 even:bg-slate-50/60 hover:bg-brand-50/40"
                >
                  <td className="px-3 py-2.5 text-slate-600 tabular-nums">
                    <div>{new Date(tx.occurredAt).toLocaleDateString(dateLocale)}</div>
                    <div className="text-[10px] text-slate-400">
                      {new Date(tx.occurredAt).toLocaleTimeString(dateLocale, {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </td>
                  <td className="truncate px-3 py-2.5 text-slate-400 tabular-nums">
                    {tx.documentNo}
                  </td>
                  <td className="truncate px-3 py-2.5" title={tx.description ?? undefined}>
                    <span className="text-slate-900">{tx.description}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{kg ?? ''}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{dona ?? ''}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-rose-600">
                    {isChiqim ? currencyFormatter.format(tx.creditAmount) : ''}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-emerald-600">
                    {tx.debitAccountType === 'receivable'
                      ? currencyFormatter.format(tx.debitAmount)
                      : ''}
                  </td>
                  <td className="truncate px-3 py-2.5">
                    {isChiqim && tx.dueDate ? (
                      <Badge tone={tone ?? 'neutral'}>
                        {new Date(tx.dueDate).toLocaleDateString(dateLocale)}
                      </Badge>
                    ) : (
                      ''
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-semibold">
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
                      <button
                        type="button"
                        onClick={() => setEditing(tx)}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        title={t('common.edit')}
                      >
                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-8.5 8.5a1 1 0 01-.464.263l-3 .75a.5.5 0 01-.606-.606l.75-3a1 1 0 01.263-.464l8.5-8.5z" />
                        </svg>
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
            {!transactions?.length && (
              <tr>
                <td colSpan={columnCount} className="py-10 text-center text-sm text-slate-500">
                  {t('ledger.empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

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
