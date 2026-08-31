'use client';

import type { CounterpartyJournalRow, CounterpartyStatement } from '@mubosher/shared';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Card } from '@/components/ui/Card';

const money = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });

export interface AgingTotals {
  /** 1–30, 31–60, 61–90, 90+ — in that order, and they sum to `overdue`. */
  buckets: [number, number, number, number];
  overdue: number;
  notYetDue: number;
  debt: number;
}

/** The whole book: one client's ladder plus the next, added up. */
export function agingFromJournal(rows: CounterpartyJournalRow[]): AgingTotals {
  return rows.reduce<AgingTotals>(
    (acc, row) => ({
      buckets: [
        acc.buckets[0] + row.overdue1To30,
        acc.buckets[1] + row.overdue31To60,
        acc.buckets[2] + row.overdue61To90,
        acc.buckets[3] + row.overdue90Plus,
      ],
      overdue: acc.overdue + row.overdueAmount,
      notYetDue: acc.notYetDue + row.notYetDue,
      debt: acc.debt + row.totalDebt,
    }),
    { buckets: [0, 0, 0, 0], overdue: 0, notYetDue: 0, debt: 0 },
  );
}

/** One client's, from the statement their own page already has. */
export function agingFromStatement(statement: CounterpartyStatement): AgingTotals {
  return {
    buckets: [
      statement.aging[0]?.amount ?? 0,
      statement.aging[1]?.amount ?? 0,
      statement.aging[2]?.amount ?? 0,
      statement.aging[3]?.amount ?? 0,
    ],
    overdue: statement.overdueAmount,
    notYetDue: statement.notYetDue,
    debt: statement.totalDebt,
  };
}

/**
 * The aged receivable — how long the overdue money has been overdue.
 *
 * A single "muddati o'tgan" total says a client is late. This says whether the
 * book is a week late or a season late, which is the difference between a phone
 * call and a lawyer, and it is the one analysis a finance department asks for
 * that the app could produce in Excel and never showed on screen.
 *
 * Deliberately one series in one colour, on four labelled rows, rather than a
 * five-colour stacked strip: the bucket a bar belongs to is written next to it,
 * so hue would be carrying nothing that the label does not already carry — and
 * in dark mode the neutral and the alarm shade sit close enough that a
 * red-blind reader could not have separated them anyway. The part that is not
 * overdue is a figure below the ladder, not a fifth segment, because it is not
 * a stage of lateness.
 */
export function AgingLadder({
  totals,
  bare = false,
}: {
  totals: AgingTotals;
  /** True when it already sits inside a card — on a client's analytics panel. */
  bare?: boolean;
}) {
  const { t } = useLocale();

  const buckets = (
    ['export.aging1', 'export.aging2', 'export.aging3', 'export.aging4'] as const
  ).map((key, i) => ({ label: t(key), amount: totals.buckets[i] ?? 0 }));

  const Frame = bare ? 'div' : Card;

  return (
    <Frame className={bare ? 'flex flex-col' : 'flex flex-col p-4'}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-fin-lg font-semibold text-slate-900">{t('analytics.agingTitle')}</h2>
        <span className="text-fin-sm text-slate-500">
          {t('analytics.overdueTotal')}:{' '}
          <span className="font-semibold tabular-nums text-rose-700">
            {money.format(totals.overdue)}
          </span>
        </span>
      </div>

      {totals.overdue <= 0 ? (
        <p className="text-fin-md text-slate-500">{t('analytics.noOverdue')}</p>
      ) : (
        <ul className="space-y-2.5">
          {buckets.map((bucket) => {
            const share = totals.overdue > 0 ? bucket.amount / totals.overdue : 0;
            const percent = Math.round(share * 100);
            return (
              <li
                key={bucket.label}
                className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-3"
              >
                <span className="text-fin-sm text-slate-600">{bucket.label}</span>
                {/* A recessive track the bar is measured against, so an empty
                    bucket still reads as "nothing here" rather than as a gap. */}
                <span
                  className="block h-2 overflow-hidden rounded-full bg-slate-100"
                  title={`${bucket.label}: ${money.format(bucket.amount)} (${percent}%)`}
                >
                  {/* Square at the baseline, rounded at the data end — the bar
                      is measured from the left, not floating. */}
                  <span
                    className="block h-2 rounded-r-full bg-rose-600"
                    style={{ width: `${share * 100}%` }}
                  />
                </span>
                <span className="text-right tabular-nums">
                  <span className="block text-fin-md font-semibold text-slate-900">
                    {bucket.amount > 0 ? money.format(bucket.amount) : '—'}
                  </span>
                  <span className="block text-fin-xs text-slate-400">
                    {bucket.amount > 0 ? `${percent}%` : ''}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {/* Not a fifth bucket: money whose day has not come is not late by any
          amount, and putting it on the ladder would read as the mildest stage
          of lateness rather than the absence of it. */}
      <dl className="mt-4 space-y-1 border-t border-slate-100 pt-3 text-fin-md">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-slate-500">{t('export.notYetDue')}</dt>
          <dd className="tabular-nums text-slate-700">{money.format(totals.notYetDue)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 font-semibold">
          <dt className="text-slate-600">{t('analytics.totalDebt')}</dt>
          <dd className="tabular-nums text-slate-900">{money.format(totals.debt)}</dd>
        </div>
      </dl>
    </Frame>
  );
}
