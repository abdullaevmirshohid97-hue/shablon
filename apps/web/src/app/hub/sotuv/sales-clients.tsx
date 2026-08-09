'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSalesByCounterparty } from '@mubosher/api-client';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';

const money = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
const qty = new Intl.NumberFormat('ru-RU');

/**
 * The sales desk opens on its clients, not on its documents.
 *
 * "Who has bought, and for how much" is the question actually asked at this
 * desk; the invoice list answers "which pieces of paper exist", which is a
 * different and much less useful thing to be shown first. Clicking a client
 * goes to their invoices — the papers are one level down, where they belong.
 */
export function SalesClients({ orgId }: { orgId: string }) {
  const { t, locale } = useLocale();
  const dateLocale = locale === 'ru' ? 'ru-RU' : 'uz-UZ';
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [search, setSearch] = useState('');
  const { data: clients, isLoading } = useSalesByCounterparty(supabase, orgId, search);

  const totals = (clients ?? []).reduce(
    (acc, c) => ({
      amount: acc.amount + (c.totalAmount ?? 0),
      open: acc.open + c.openCount,
      packages: acc.packages + c.packageCount,
    }),
    { amount: 0, open: 0, packages: 0 },
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {t('sotuv.clientsTitle')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{t('sotuv.clientsDescription')}</p>
        </div>
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('sotuv.searchPlaceholder')}
          className="w-full max-w-xs"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            {t('sotuv.clients')}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
            {clients?.length ?? 0}
          </p>
        </Card>
        <Card className="p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            {t('sotuv.totalAmount')}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
            {money.format(totals.amount)}
          </p>
        </Card>
        <Card className="p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            {t('sotuv.openInvoices')}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-amber-700">{totals.open}</p>
        </Card>
        <Card className="p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            {t('sotuv.packages')}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
            {totals.packages}
          </p>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="px-4 py-2.5 font-medium">{t('sotuv.client')}</th>
                <th className="px-4 py-2.5 text-right font-medium">{t('sotuv.invoiceCount')}</th>
                <th className="px-4 py-2.5 text-right font-medium">{t('sotuv.ordered')}</th>
                <th className="px-4 py-2.5 text-right font-medium">{t('sotuv.shipped')}</th>
                <th className="px-4 py-2.5 text-right font-medium">{t('sotuv.packages')}</th>
                <th className="px-4 py-2.5 text-right font-medium">{t('sotuv.totalAmount')}</th>
                <th className="px-4 py-2.5 font-medium">{t('sotuv.lastSale')}</th>
              </tr>
            </thead>
            <tbody>
              {(clients ?? []).map((c) => (
                <tr key={c.counterpartyId} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/hub/sotuv/faktura?client=${c.counterpartyId}`}
                      className="font-medium text-slate-900 hover:text-brand-600 hover:underline"
                    >
                      {c.counterpartyName}
                    </Link>
                    {c.openCount > 0 && (
                      <Badge tone="warning" className="ml-2">
                        {t('sotuv.openShort').replace('{n}', String(c.openCount))}
                      </Badge>
                    )}
                    {c.phone && <p className="text-xs text-slate-500">{c.phone}</p>}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{c.invoiceCount}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {qty.format(c.orderedDona)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">
                    {qty.format(c.shippedDona)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{c.packageCount}</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                    {c.totalAmount == null ? '—' : money.format(c.totalAmount)}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 tabular-nums">
                    {c.lastIssuedAt ? new Date(c.lastIssuedAt).toLocaleDateString(dateLocale) : '—'}
                  </td>
                </tr>
              ))}
              {!isLoading && !clients?.length && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-slate-500">
                    {t('sotuv.empty')}
                  </td>
                </tr>
              )}
              {isLoading && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-slate-500">
                    {t('common.loading')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
