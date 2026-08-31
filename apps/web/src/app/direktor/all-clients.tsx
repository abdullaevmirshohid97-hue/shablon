'use client';

import { useMemo, useState, useTransition } from 'react';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import type { OrgOption } from '@/lib/auth/activeOrg';
import { chooseOrg } from '@/app/select-org/actions';
import { useAllOrgJournals } from '@/lib/director/useDirectorData';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { ToggleChip } from '@/components/ui/Badge';

const money = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });

/**
 * Every client of every business, on one list.
 *
 * The organization is a column rather than a heading, because the question
 * this screen answers is "who owes me money", and the answer does not sort
 * itself by company first. It sorts by what is late.
 */
export function DirectorClients({ orgs }: { orgs: OrgOption[] }) {
  const { t, locale } = useLocale();
  const dateLocale = locale === 'ru' ? 'ru-RU' : 'uz-UZ';
  const { data, isLoading } = useAllOrgJournals(orgs);

  const [search, setSearch] = useState('');
  const [orgFilter, setOrgFilter] = useState<string | null>(null);
  const [onlyLate, setOnlyLate] = useState(false);
  const [, startTransition] = useTransition();

  /**
   * Opening a client from here is also stepping into their business.
   *
   * Their page renders through whichever organization is active, so a plain
   * link would have shown one company's client inside another company's shell
   * — and behind another company's module gate. Switching first is what makes
   * the destination mean what the row said.
   */
  function open(orgId: string, counterpartyId: string) {
    startTransition(() => {
      void chooseOrg(orgId, `/counterparty/${counterpartyId}`);
    });
  }

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return (data ?? [])
      .filter((book) => !orgFilter || book.org.orgId === orgFilter)
      .flatMap((book) => book.rows.map((row) => ({ ...row, org: book.org })))
      .filter((row) => {
        if (onlyLate && row.overdueAmount <= 0) return false;
        if (!needle) return true;
        return [row.name, row.phone, row.managerName]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(needle);
      })
      .sort((a, b) => b.overdueAmount - a.overdueAmount || b.totalDebt - a.totalDebt);
  }, [data, search, orgFilter, onlyLate]);

  return (
    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('overview.journalSearch')}
          className="min-w-[200px] flex-1"
        />
        {orgs.length > 1 && (
          <>
            <ToggleChip active={orgFilter === null} onClick={() => setOrgFilter(null)}>
              {t('categories.all')}
            </ToggleChip>
            {orgs.map((org) => (
              <ToggleChip
                key={org.orgId}
                active={orgFilter === org.orgId}
                onClick={() => setOrgFilter(orgFilter === org.orgId ? null : org.orgId)}
              >
                {org.name}
              </ToggleChip>
            ))}
          </>
        )}
        <ToggleChip active={onlyLate} onClick={() => setOnlyLate((v) => !v)}>
          {t('overview.onlyOverdue')}
        </ToggleChip>
      </div>

      <div className="max-h-[70vh] overflow-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[860px] border-collapse text-fin-md">
          <thead className="sticky top-0 z-10 bg-slate-50">
            <tr className="border-b border-slate-200 text-left text-fin-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2 font-medium">{t('overview.debtorName')}</th>
              <th className="px-3 py-2 font-medium">{t('director.organization')}</th>
              <th className="px-3 py-2 font-medium">{t('overview.manager')}</th>
              <th className="px-3 py-2 text-right font-medium">{t('overview.overdueSum')}</th>
              <th className="px-3 py-2 font-medium">{t('overview.overdueSince')}</th>
              <th className="px-3 py-2 text-right font-medium">{t('overview.totalDebtShort')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={`${row.org.orgId}:${row.counterpartyId}`}
                className="border-b border-slate-100 hover:bg-slate-50"
              >
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => open(row.org.orgId, row.counterpartyId)}
                    className="text-left font-medium text-slate-900 hover:text-brand-700 hover:underline"
                  >
                    {row.name}
                  </button>
                  {row.phone && (
                    <span className="block text-fin-xs text-slate-400">{row.phone}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {row.org.name}
                  <span className="ml-1 text-fin-xs text-slate-400">{row.org.baseCurrency}</span>
                </td>
                <td className="px-3 py-2 text-slate-600">{row.managerName ?? '—'}</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums text-rose-700">
                  {row.overdueAmount > 0 ? money.format(row.overdueAmount) : '—'}
                </td>
                <td className="px-3 py-2 tabular-nums text-rose-700">
                  {row.overdueDate ? new Date(row.overdueDate).toLocaleDateString(dateLocale) : '—'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                  {money.format(row.totalDebt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {isLoading && (
          <p className="p-6 text-center text-fin-md text-slate-500">{t('common.loading')}</p>
        )}
        {!isLoading && rows.length === 0 && (
          <p className="p-6 text-center text-fin-md text-slate-500">{t('overview.journalEmpty')}</p>
        )}
      </div>

      <p className="mt-2 text-fin-sm text-slate-500">
        {rows.length} · {t('director.mixedCurrencyNote')}
      </p>
    </Card>
  );
}
