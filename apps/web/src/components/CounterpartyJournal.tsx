'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useCounterpartyJournal, type CounterpartyJournalFilters } from '@mubosher/api-client';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Card } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Input';
import { ToggleChip } from '@/components/ui/Badge';

const money = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });

/**
 * Every client on one line, as a journal.
 *
 * The header stays put and the body scrolls, because this list is read by
 * scanning a column — losing the column names two rows in is what makes a
 * long table useless. Filters sit above it for the same reason: the question
 * is almost always "which of my clients", not "all of them".
 *
 * Both debt figures are here and they are not the same number. Total is what
 * the client owes today. Overdue is what was outstanding when the deadline
 * passed, less everything paid since — so a payment lowers it and a new sale
 * raises only the total.
 */
export function CounterpartyJournal({ orgId }: { orgId: string }) {
  const { t, locale } = useLocale();
  const dateLocale = locale === 'ru' ? 'ru-RU' : 'uz-UZ';
  const [supabase] = useState(() => createSupabaseBrowserClient());

  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState<CounterpartyJournalFilters>({});
  const [roster, setRoster] = useState<
    { user_id: string; full_name: string | null; email: string | null }[]
  >([]);
  const [currencies, setCurrencies] = useState<string[]>([]);

  // The list comes from Postgres, so every keystroke would be a round trip.
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((f) => (f.search === searchInput ? f : { ...f, search: searchInput }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    void supabase
      .rpc('list_org_roster', { target_org_id: orgId })
      .then(({ data }) => setRoster(data ?? []));
    void supabase
      .from('currencies')
      .select('code')
      .order('code')
      .then(({ data }) => setCurrencies((data ?? []).map((c) => c.code)));
  }, [supabase, orgId]);

  const { data: rows, isLoading } = useCounterpartyJournal(supabase, orgId, filters);

  const totals = useMemo(
    () =>
      (rows ?? []).reduce(
        (acc, row) => ({
          overdue: acc.overdue + row.overdueAmount,
          total: acc.total + row.totalDebt,
        }),
        { overdue: 0, total: 0 },
      ),
    [rows],
  );

  function setFilter<K extends keyof CounterpartyJournalFilters>(
    key: K,
    value: CounterpartyJournalFilters[K],
  ) {
    setFilters((f) => ({ ...f, [key]: value }));
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-fin-lg font-semibold text-slate-900">{t('overview.journalTitle')}</h2>
        <span className="text-fin-sm text-slate-500 tabular-nums">
          {(rows ?? []).length} · {money.format(totals.total)}
        </span>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t('overview.journalSearch')}
          className="min-w-[200px] flex-1"
        />
        <Select
          value={filters.managerId ?? ''}
          onChange={(e) => setFilter('managerId', e.target.value)}
          className="w-44"
        >
          <option value="">{t('overview.manager')}</option>
          {roster.map((r) => (
            <option key={r.user_id} value={r.user_id}>
              {r.full_name ?? r.email}
            </option>
          ))}
        </Select>
        <Select
          value={filters.currency ?? ''}
          onChange={(e) => setFilter('currency', e.target.value)}
          className="w-32"
        >
          <option value="">{t('sklad.price.currencyLabel')}</option>
          {currencies.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </Select>
        <ToggleChip
          active={!!filters.onlyOverdue}
          onClick={() => setFilter('onlyOverdue', !filters.onlyOverdue)}
        >
          {t('overview.onlyOverdue')}
        </ToggleChip>
        <ToggleChip
          active={!!filters.onlyDebtors}
          onClick={() => setFilter('onlyDebtors', !filters.onlyDebtors)}
        >
          {t('overview.onlyDebtors')}
        </ToggleChip>
      </div>

      {/* Fixed head, scrolling body: the column names have to survive row
          forty, which is where this table is actually read. */}
      <div className="max-h-[520px] overflow-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[820px] border-collapse text-fin-md">
          <thead className="sticky top-0 z-10 bg-slate-50">
            <tr className="border-b border-slate-200 text-left text-fin-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2 font-medium">{t('overview.debtorName')}</th>
              <th className="px-3 py-2 font-medium">{t('overview.manager')}</th>
              <th className="px-3 py-2 text-right font-medium">{t('overview.overdueSum')}</th>
              <th className="px-3 py-2 font-medium">{t('overview.overdueSince')}</th>
              <th className="px-3 py-2 text-right font-medium">{t('overview.totalDebtShort')}</th>
              <th className="px-3 py-2 font-medium">{t('overview.nextDue')}</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((row) => (
              <tr key={row.counterpartyId} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2">
                  <Link
                    href={`/counterparty/${row.counterpartyId}`}
                    className="font-medium text-slate-900 hover:text-brand-700 hover:underline"
                  >
                    {row.name}
                  </Link>
                  {row.phone && (
                    <span className="block text-fin-xs text-slate-400">{row.phone}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-slate-600">{row.managerName ?? '—'}</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums text-rose-700">
                  {row.overdueAmount > 0 ? money.format(row.overdueAmount) : '—'}
                </td>
                <td className="px-3 py-2 tabular-nums text-rose-600">
                  {row.overdueDate ? new Date(row.overdueDate).toLocaleDateString(dateLocale) : '—'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                  {money.format(row.totalDebt)}
                  <span className="ml-1 text-fin-xs text-slate-400">{row.currency}</span>
                </td>
                <td className="px-3 py-2 tabular-nums text-slate-500">
                  {row.nextDueDate ? new Date(row.nextDueDate).toLocaleDateString(dateLocale) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
          {(rows ?? []).length > 0 && (
            <tfoot className="sticky bottom-0 bg-slate-50">
              <tr className="border-t-2 border-slate-300 font-semibold">
                <td className="px-3 py-2 text-fin-sm uppercase text-slate-500" colSpan={2}>
                  {t('sklad.totals.label')}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-rose-700">
                  {money.format(totals.overdue)}
                </td>
                <td />
                <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                  {money.format(totals.total)}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>

        {isLoading && (
          <p className="p-6 text-center text-fin-md text-slate-500">{t('common.loading')}</p>
        )}
        {!isLoading && (rows ?? []).length === 0 && (
          <p className="p-6 text-center text-fin-md text-slate-500">{t('overview.journalEmpty')}</p>
        )}
      </div>
    </Card>
  );
}
