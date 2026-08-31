'use client';

import Link from 'next/link';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import type { OrgOption } from '@/lib/auth/activeOrg';
import { useAllOrgJournals } from '@/lib/director/useDirectorData';
import { Card, StatCard } from '@/components/ui/Card';
import { AgingLadder, agingFromJournal } from '@/components/AgingLadder';

const money = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });

/**
 * Every business on one screen.
 *
 * The totals across organizations are counted, not summed: a group holding one
 * book in sums and another in dollars has no single number for what it is
 * owed, and printing one would be inventing an exchange rate the ledger never
 * agreed to. Each organization states its own figure in its own currency; what
 * the top of the page adds up is businesses, clients and people.
 */
export function DirectorOverview({ orgs }: { orgs: OrgOption[] }) {
  const { t } = useLocale();
  const { data, isLoading, error } = useAllOrgJournals(orgs);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {orgs.map((o) => (
          <div key={o.orgId} className="h-48 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-fin-md text-rose-600">
        {t('common.error')}: {(error as Error).message}
      </p>
    );
  }

  const books = data ?? [];
  const clientCount = books.reduce((n, b) => n + b.rows.length, 0);
  const lateCount = books.reduce((n, b) => n + b.rows.filter((r) => r.overdueAmount > 0).length, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label={t('director.orgCount')} value={String(books.length)} />
        <StatCard label={t('overview.clientCount')} value={String(clientCount)} />
        <StatCard
          label={t('director.lateClients')}
          value={String(lateCount)}
          tone={lateCount > 0 ? 'danger' : 'neutral'}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {books.map(({ org, rows }) => {
          const aging = agingFromJournal(rows);
          return (
            <Card key={org.orgId} className="flex flex-col gap-3 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-fin-lg font-semibold text-slate-900">{org.name}</h2>
                <span className="text-fin-sm text-slate-500">
                  {t('overview.amountsIn').replace('{code}', org.baseCurrency)}
                </span>
              </div>

              <dl className="grid grid-cols-3 gap-3 border-y border-slate-100 py-3">
                <Figure label={t('overview.clientCount')} value={String(rows.length)} />
                <Figure label={t('analytics.totalDebt')} value={money.format(aging.debt)} />
                <Figure
                  label={t('overview.overdueSum')}
                  value={money.format(aging.overdue)}
                  tone={aging.overdue > 0 ? 'danger' : 'neutral'}
                />
              </dl>

              <AgingLadder totals={aging} bare />

              <div className="mt-1 flex flex-wrap gap-3 text-fin-sm">
                <Link href="/direktor/mijozlar" className="text-slate-500 hover:text-slate-900">
                  {t('director.tabClients')}
                </Link>
                <Link href="/direktor/menejerlar" className="text-slate-500 hover:text-slate-900">
                  {t('director.tabManagers')}
                </Link>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Figure({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'danger';
}) {
  return (
    <div>
      <dt className="text-fin-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd
        className={`mt-0.5 text-fin-md font-semibold tabular-nums ${
          tone === 'danger' ? 'text-rose-700' : 'text-slate-900'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
