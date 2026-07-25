'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { computeRunningBalance, type LedgerTransaction } from '@mubosher/shared';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

const currencyFormatter = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 0 });

interface ModuleCounterparty {
  id: string;
  categories: string[];
}

interface ModuleRow {
  name: string;
  clientCount: number;
  kirim: number;
  chiqim: number;
  qarz: number;
}

function outstandingDebt(counterpartyIds: Set<string>, transactions: LedgerTransaction[]): number {
  const byCounterparty = new Map<string, LedgerTransaction[]>();
  for (const tx of transactions) {
    if (!counterpartyIds.has(tx.counterpartyId)) continue;
    const list = byCounterparty.get(tx.counterpartyId);
    if (list) list.push(tx);
    else byCounterparty.set(tx.counterpartyId, [tx]);
  }

  let total = 0;
  for (const txs of byCounterparty.values()) {
    const balances = computeRunningBalance(txs);
    const last = balances[balances.length - 1];
    if (last && last.side === 'debit') total += last.balance;
  }
  return total;
}

export function ModuleBreakdownTable({
  modules,
  counterparties,
  transactions,
}: {
  modules: { id: string; name: string }[];
  counterparties: ModuleCounterparty[];
  transactions: LedgerTransaction[];
}) {
  const { t } = useLocale();

  const rows = useMemo<ModuleRow[]>(() => {
    return modules.map((m) => {
      const ids = new Set(
        counterparties.filter((c) => c.categories?.includes(m.name)).map((c) => c.id),
      );
      const moduleTx = transactions.filter((t) => ids.has(t.counterpartyId));

      let kirim = 0;
      let chiqim = 0;
      for (const tx of moduleTx) {
        if (tx.debitAccountType === 'receivable') kirim += tx.debitAmount;
        if (tx.creditAccountType === 'receivable') chiqim += tx.creditAmount;
      }

      return {
        name: m.name,
        clientCount: ids.size,
        kirim,
        chiqim,
        qarz: outstandingDebt(ids, transactions),
      };
    });
  }, [modules, counterparties, transactions]);

  if (!rows.length) return null;

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-base font-semibold text-slate-900">{t('overview.byModule')}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-50">
            <tr className="border-b border-slate-200 text-left">
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {t('overview.module')}
              </th>
              <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {t('overview.clientCount')}
              </th>
              <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {t('ledger.kirim')}
              </th>
              <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {t('ledger.chiqim')}
              </th>
              <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {t('ledger.qarz')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.name}
                className="border-b border-slate-100 last:border-0 even:bg-slate-50/60"
              >
                <td className="px-4 py-2.5">
                  <Link
                    href={`/dashboard/${encodeURIComponent(row.name)}`}
                    className="font-medium text-slate-900 hover:text-brand-700"
                  >
                    {row.name}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">
                  {row.clientCount}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-emerald-600">
                  {currencyFormatter.format(row.kirim)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-rose-600">
                  {currencyFormatter.format(row.chiqim)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {row.qarz > 0 ? (
                    <Badge tone="success">{currencyFormatter.format(row.qarz)}</Badge>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
