'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  computePeriodStats,
  getDueSoonAndOverdue,
  getOverdueByCounterparty,
  getPeriodRange,
  type LedgerTransaction,
  type PeriodKind,
} from '@mubosher/shared';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Card } from '@/components/ui/Card';
import { Segmented } from '@/components/ui/Segmented';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';

const currencyFormatter = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2 });
const qtyFormatter = new Intl.NumberFormat('ru-RU');

export function LedgerAnalytics({
  transactions,
  counterparties,
  forcePrintVisible = false,
}: {
  transactions: LedgerTransaction[];
  counterparties: { id: string; name: string }[];
  /** When true (set right before printing), this section ignores its normal print:hidden rule. */
  forcePrintVisible?: boolean;
}) {
  const { t, locale } = useLocale();
  const dateLocale = locale === 'ru' ? 'ru-RU' : 'uz-UZ';
  const [periodKind, setPeriodKind] = useState<PeriodKind>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const today = useMemo(() => new Date(), []);

  const range = useMemo(() => {
    if (periodKind === 'custom') {
      if (!customStart || !customEnd) return null;
      return getPeriodRange('custom', today, { start: customStart, end: customEnd });
    }
    return getPeriodRange(periodKind, today);
  }, [periodKind, customStart, customEnd, today]);

  const stats = useMemo(
    () => (range ? computePeriodStats(transactions, range) : null),
    [transactions, range],
  );

  // Muddati o'tgan qarz — davr filtridan mustaqil (joriy holat, tarixiy davr emas),
  // mijoz bo'yicha yig'ilgan (LedgerTable'dagi har-qatorli konvensiyaning davomi).
  const { dueSoon } = useMemo(
    () => getDueSoonAndOverdue(transactions, today, 7),
    [transactions, today],
  );

  const overdueRows = useMemo(() => {
    const byCounterparty = getOverdueByCounterparty(transactions, today);
    const nameById = new Map(counterparties.map((c) => [c.id, c.name]));
    return Object.entries(byCounterparty)
      .map(([id, debt]) => ({ id, name: nameById.get(id) ?? '—', ...debt }))
      .sort((a, b) => b.overdueAmount - a.overdueAmount);
  }, [transactions, today, counterparties]);

  const overdueTotal = useMemo(
    () => overdueRows.reduce((sum, row) => sum + row.overdueAmount, 0),
    [overdueRows],
  );

  return (
    <Card className={`p-4 ${forcePrintVisible ? '' : 'no-print'}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900">{t('analytics.title')}</h2>
        <Segmented
          className="no-print"
          value={periodKind}
          onChange={setPeriodKind}
          options={[
            { value: 'week', label: t('analytics.week') },
            { value: 'month', label: t('analytics.month') },
            { value: 'quarter', label: t('analytics.quarter') },
            { value: 'year', label: t('analytics.year') },
            { value: 'custom', label: t('analytics.custom') },
          ]}
        />
      </div>

      {periodKind === 'custom' && (
        <div className="no-print mb-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              {t('analytics.from')}
            </label>
            <Input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              {t('analytics.to')}
            </label>
            <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
          </div>
        </div>
      )}

      {(overdueRows.length > 0 || dueSoon.length > 0) && (
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-rose-700">
              {t('analytics.overdueTitle')} ({overdueRows.length})
            </p>
            {overdueTotal > 0 && (
              <div className="mb-3">
                <p className="text-[11px] font-medium text-rose-600">
                  {t('analytics.overdueTotal')}
                </p>
                <p className="text-2xl font-bold tabular-nums text-rose-700">
                  {currencyFormatter.format(overdueTotal)}
                </p>
              </div>
            )}
            <ul className="space-y-1">
              {overdueRows.map((row) => (
                <li key={row.id}>
                  <Link
                    href={`/counterparty/${row.id}`}
                    className="flex items-center justify-between gap-2 text-sm hover:underline"
                  >
                    <span className="truncate font-medium text-rose-700">{row.name}</span>
                    <span className="ml-2 shrink-0 text-right">
                      <span className="block tabular-nums font-semibold text-rose-700">
                        {currencyFormatter.format(row.overdueAmount)}
                      </span>
                      <span className="block text-xs text-rose-500">
                        {new Date(row.overdueDate).toLocaleDateString(dateLocale)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
              {!overdueRows.length && (
                <li className="text-sm text-slate-400">{t('analytics.noDueItems')}</li>
              )}
            </ul>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
              {t('analytics.dueSoonTitle')} ({dueSoon.length})
            </p>
            <ul className="space-y-1">
              {dueSoon.map((tx) => (
                <li key={tx.id} className="flex items-center justify-between text-sm">
                  <span className="truncate text-slate-700">{tx.description}</span>
                  <span className="ml-2 shrink-0 tabular-nums text-amber-700">
                    {tx.dueDate && new Date(tx.dueDate).toLocaleDateString(dateLocale)}
                  </span>
                </li>
              ))}
              {!dueSoon.length && (
                <li className="text-sm text-slate-400">{t('analytics.noDueItems')}</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {stats ? (
        <>
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-xs font-medium text-emerald-700">{t('analytics.totalKirim')}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-emerald-700">
                {currencyFormatter.format(stats.totalKirim)}
              </p>
            </div>
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
              <p className="text-xs font-medium text-rose-700">{t('analytics.totalChiqim')}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-rose-700">
                {currencyFormatter.format(stats.totalChiqim)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-300 bg-slate-100 p-3">
              <p className="text-xs font-medium text-slate-600">{t('analytics.net')}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
                {currencyFormatter.format(stats.net)}
              </p>
            </div>
          </div>

          {stats.byCategory.length > 0 ? (
            <div className="mb-4 overflow-x-auto">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t('analytics.byCategory')}
              </p>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                    <th className="py-1.5 pr-3 font-medium">{t('analytics.category')}</th>
                    <th className="py-1.5 pr-3 text-right font-medium">
                      {t('transaction.quantity')}
                    </th>
                    <th className="py-1.5 pr-3 font-medium">{t('analytics.unit')}</th>
                    <th className="py-1.5 text-right font-medium">{t('analytics.amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.byCategory.map((c, i) => (
                    <tr
                      key={`${c.categoryName}-${c.unit}-${c.kind}-${i}`}
                      className="border-b border-slate-100"
                    >
                      <td className="py-1.5 pr-3">
                        {c.categoryName}{' '}
                        <Badge tone={c.kind === 'kirim' ? 'success' : 'danger'}>
                          {t(`ledger.${c.kind}`)}
                        </Badge>
                      </td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">
                        {c.unit ? qtyFormatter.format(c.totalQuantity) : '—'}
                      </td>
                      <td className="py-1.5 pr-3 text-slate-500">{c.unit ?? '—'}</td>
                      <td className="py-1.5 text-right tabular-nums">
                        {currencyFormatter.format(c.totalAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mb-4 text-sm text-slate-500">{t('analytics.noData')}</p>
          )}
        </>
      ) : (
        <p className="mb-4 text-sm text-slate-500">{t('analytics.noData')}</p>
      )}

      {stats && (
        <p className="mt-4 text-xs text-slate-400">
          {t('analytics.transactionCount')}: {stats.transactionCount}
        </p>
      )}
    </Card>
  );
}
