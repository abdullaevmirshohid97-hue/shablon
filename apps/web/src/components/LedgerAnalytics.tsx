'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import type { AnalyticsData } from '@/lib/analyticsData';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Card, StatCard } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatPeriodLabel, type PeriodFilterState } from '@/components/PeriodFilter';

const currencyFormatter = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2 });
const qtyFormatter = new Intl.NumberFormat('ru-RU');

export function LedgerAnalytics({
  data,
  period,
  forcePrintVisible = false,
}: {
  /**
   * Already aggregated — in Postgres for the dashboard, in the browser for a
   * single client's ledger. This card only draws it.
   */
  data: AnalyticsData;
  /**
   * Owned by the page, not by this card: one control in the toolbar drives
   * the figures here, the rows in the table, the print header and the Excel
   * file, so a report can never disagree with the screen it came from.
   */
  period: PeriodFilterState;
  /** When true (set right before printing), this section ignores its normal print:hidden rule. */
  forcePrintVisible?: boolean;
}) {
  const { t, locale } = useLocale();
  const dateLocale = locale === 'ru' ? 'ru-RU' : 'uz-UZ';

  const stats = data;
  const overdueRows = data.overdue;
  const dueSoon = data.dueSoon;

  const overdueTotal = useMemo(
    () => overdueRows.reduce((sum, row) => sum + row.overdueAmount, 0),
    [overdueRows],
  );

  return (
    <Card className={`p-4 ${forcePrintVisible ? '' : 'no-print'}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900">{t('analytics.title')}</h2>
        <span className="text-xs text-slate-500">
          {formatPeriodLabel(period.range, dateLocale, t('export.periodAll'))}
        </span>
      </div>

      {(overdueRows.length > 0 || dueSoon.length > 0) && (
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-rose-700">
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
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-amber-700">
              {t('analytics.dueSoonTitle')} ({dueSoon.length})
            </p>
            <ul className="space-y-1">
              {dueSoon.map((row) => (
                <li key={row.id} className="flex items-center justify-between text-sm">
                  <span className="truncate text-slate-700">{row.label}</span>
                  <span className="ml-2 shrink-0 tabular-nums text-amber-700">
                    {new Date(row.dueDate).toLocaleDateString(dateLocale)}
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

      {/* Three filled colour blocks side by side read as a traffic light and
          drowned the figures they were meant to present. The tone now lives in
          a 2px rule on the edge; the number itself carries the colour. */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t('analytics.totalKirim')}
          value={currencyFormatter.format(stats.totalKirim)}
          tone="success"
        />
        <StatCard
          label={t('analytics.totalChiqim')}
          value={currencyFormatter.format(stats.totalChiqim)}
          tone="danger"
        />
        {/* Debt is a position and does not move with the period filter; revenue
            is a flow and does. They sat under one label until 0029, and the
            label was the wrong one for both. */}
        <StatCard
          label={t('analytics.totalDebt')}
          value={currencyFormatter.format(stats.totalDebt)}
        />
        <StatCard
          label={t('analytics.netRevenue')}
          value={currencyFormatter.format(stats.netRevenue)}
        />
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
                <th className="py-1.5 pr-3 text-right font-medium">{t('transaction.quantity')}</th>
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

      <p className="mt-4 text-xs text-slate-400">
        {t('analytics.transactionCount')}: {stats.transactionCount}
      </p>
    </Card>
  );
}
