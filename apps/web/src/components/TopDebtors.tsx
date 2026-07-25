'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { computeRunningBalance, type LedgerTransaction } from '@mubosher/shared';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Card } from '@/components/ui/Card';

const currencyFormatter = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 0 });

interface DebtorRow {
  id: string;
  name: string;
  balance: number;
}

export function TopDebtors({
  counterparties,
  transactions,
  limit = 6,
}: {
  counterparties: { id: string; name: string }[];
  transactions: LedgerTransaction[];
  limit?: number;
}) {
  const { t } = useLocale();

  const rows = useMemo<DebtorRow[]>(() => {
    const nameById = new Map(counterparties.map((c) => [c.id, c.name]));
    const byCounterparty = new Map<string, LedgerTransaction[]>();
    for (const tx of transactions) {
      const list = byCounterparty.get(tx.counterpartyId);
      if (list) list.push(tx);
      else byCounterparty.set(tx.counterpartyId, [tx]);
    }

    const result: DebtorRow[] = [];
    for (const [counterpartyId, txs] of byCounterparty) {
      const balances = computeRunningBalance(txs);
      const last = balances[balances.length - 1];
      if (last && last.side === 'debit' && last.balance > 0) {
        result.push({
          id: counterpartyId,
          name: nameById.get(counterpartyId) ?? '—',
          balance: last.balance,
        });
      }
    }

    return result.sort((a, b) => b.balance - a.balance).slice(0, limit);
  }, [counterparties, transactions, limit]);

  const maxBalance = rows[0]?.balance ?? 0;

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-base font-semibold text-slate-900">{t('overview.topDebtors')}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">{t('overview.noDebtors')}</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id}>
              <Link href={`/counterparty/${row.id}`} className="group block">
                <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                  <span className="truncate font-medium text-slate-700 group-hover:text-brand-700">
                    {row.name}
                  </span>
                  <span className="shrink-0 tabular-nums font-semibold text-slate-900">
                    {currencyFormatter.format(row.balance)}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-brand-600 transition-all"
                    style={{ width: `${maxBalance > 0 ? (row.balance / maxBalance) * 100 : 0}%` }}
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
