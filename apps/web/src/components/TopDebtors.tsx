'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import type { CounterpartyJournalRow } from '@mubosher/shared';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Card } from '@/components/ui/Card';

const money = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });

/**
 * Everyone who is late, with both figures side by side.
 *
 * It used to list the six largest balances and call them debtors, which is a
 * different question — a client can owe a lot and owe none of it yet. This is
 * the ones whose deadline has passed, and it shows what is past due next to
 * what they owe altogether, because the gap between those two is the thing
 * worth looking at.
 *
 * The list scrolls rather than truncating: "eng ko'p" is a sort order, not a
 * reason to hide the seventh debtor.
 */
export function TopDebtors({ rows }: { rows: CounterpartyJournalRow[] }) {
  const { t, locale } = useLocale();
  const dateLocale = locale === 'ru' ? 'ru-RU' : 'uz-UZ';

  const debtors = useMemo(
    () =>
      rows
        .filter((row) => row.overdueDate && row.totalDebt > 0)
        .sort((a, b) => b.overdueAmount - a.overdueAmount || b.totalDebt - a.totalDebt),
    [rows],
  );

  return (
    <Card className="flex flex-col p-4">
      <h2 className="mb-3 text-base font-semibold text-slate-900">{t('overview.topDebtors')}</h2>

      {debtors.length === 0 ? (
        <p className="text-sm text-slate-500">{t('overview.noDebtors')}</p>
      ) : (
        <div className="-mx-1 max-h-[420px] overflow-y-auto px-1">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="py-1.5 pr-2 font-medium">{t('overview.debtorName')}</th>
                <th className="py-1.5 pr-2 text-right font-medium">{t('overview.overdueSum')}</th>
                <th className="py-1.5 text-right font-medium">{t('overview.totalDebtShort')}</th>
              </tr>
            </thead>
            <tbody>
              {debtors.map((row) => (
                <tr key={row.counterpartyId} className="border-b border-slate-100">
                  <td className="py-1.5 pr-2">
                    <Link
                      href={`/counterparty/${row.counterpartyId}`}
                      className="block font-medium text-slate-800 hover:text-brand-700 hover:underline"
                    >
                      {row.name}
                    </Link>
                    {row.overdueDate && (
                      <span className="text-[11px] text-rose-500">
                        {new Date(row.overdueDate).toLocaleDateString(dateLocale)}
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 pr-2 text-right font-semibold tabular-nums text-rose-700">
                    {money.format(row.overdueAmount)}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-slate-900">
                    {money.format(row.totalDebt)}
                    <span className="ml-1 text-[11px] text-slate-400">{row.currency}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
