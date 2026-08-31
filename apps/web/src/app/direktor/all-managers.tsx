'use client';

import { useMemo } from 'react';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import type { OrgOption } from '@/lib/auth/activeOrg';
import { useAllOrgJournals, useAllOrgRosters } from '@/lib/director/useDirectorData';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

const money = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });

/**
 * Everyone who works in any of the businesses, and the book each of them is
 * carrying.
 *
 * A roster on its own is a phone list. What makes it worth a director's screen
 * is the second half: how many clients each person is accountable for, what
 * those clients owe, and how much of that is late — the manager column of the
 * journal, read the other way round.
 */
export function DirectorManagers({ orgs }: { orgs: OrgOption[] }) {
  const { t } = useLocale();
  const { data: rosters, isLoading } = useAllOrgRosters(orgs);
  const { data: journals } = useAllOrgJournals(orgs);

  // What each person is carrying, keyed by org and user — a manager in two
  // businesses is two lines, because they answer for two books.
  const load = useMemo(() => {
    const map = new Map<string, { clients: number; debt: number; overdue: number }>();
    for (const book of journals ?? []) {
      for (const row of book.rows) {
        if (!row.managerId) continue;
        const key = `${book.org.orgId}:${row.managerId}`;
        const current = map.get(key) ?? { clients: 0, debt: 0, overdue: 0 };
        map.set(key, {
          clients: current.clients + 1,
          debt: current.debt + row.totalDebt,
          overdue: current.overdue + row.overdueAmount,
        });
      }
    }
    return map;
  }, [journals]);

  const unassigned = useMemo(() => {
    const map = new Map<string, number>();
    for (const book of journals ?? []) {
      const n = book.rows.filter((r) => !r.managerId).length;
      if (n > 0) map.set(book.org.orgId, n);
    }
    return map;
  }, [journals]);

  if (isLoading) {
    return <div className="h-64 animate-pulse rounded-xl bg-slate-100" />;
  }

  return (
    <div className="flex flex-col gap-4">
      {(rosters ?? []).map(({ org, members }) => (
        <Card key={org.orgId} className="p-4">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-fin-lg font-semibold text-slate-900">{org.name}</h2>
            <span className="text-fin-sm text-slate-500">
              {t('overview.amountsIn').replace('{code}', org.baseCurrency)}
            </span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[720px] border-collapse text-fin-md">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200 text-left text-fin-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2 font-medium">{t('overview.manager')}</th>
                  <th className="px-3 py-2 font-medium">{t('director.role')}</th>
                  <th className="px-3 py-2 text-right font-medium">{t('overview.clientCount')}</th>
                  <th className="px-3 py-2 text-right font-medium">
                    {t('overview.totalDebtShort')}
                  </th>
                  <th className="px-3 py-2 text-right font-medium">{t('overview.overdueSum')}</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => {
                  const carried = load.get(`${org.orgId}:${member.userId}`);
                  return (
                    <tr key={member.userId} className="border-b border-slate-100">
                      <td className="px-3 py-2">
                        <span className="block font-medium text-slate-900">
                          {member.fullName ?? member.email ?? '—'}
                        </span>
                        {member.fullName && member.email && (
                          <span className="block text-fin-xs text-slate-400">{member.email}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {member.role ? (
                          <Badge tone={member.role === 'staff' ? 'neutral' : 'brand'}>
                            {t(`role.${member.role}`)}
                          </Badge>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                        {carried?.clients ?? 0}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                        {money.format(carried?.debt ?? 0)}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums text-rose-700">
                        {carried?.overdue ? money.format(carried.overdue) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Clients nobody answers for. The most useful line on the page and
              the one a roster alone would never show. */}
          {unassigned.get(org.orgId) && (
            <p className="mt-2 text-fin-sm text-amber-700">
              {t('director.unassigned').replace('{n}', String(unassigned.get(org.orgId)))}
            </p>
          )}
        </Card>
      ))}
    </div>
  );
}
