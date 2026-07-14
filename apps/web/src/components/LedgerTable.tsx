'use client';

import { useMemo } from 'react';
import { useTransactions } from '@mubosher/api-client';
import { computeRunningBalance } from '@mubosher/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@mubosher/api-client';

const currencyFormatter = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2 });

export function LedgerTable({
  supabase,
  orgId,
  counterpartyId,
}: {
  supabase: SupabaseClient<Database>;
  orgId: string;
  counterpartyId: string;
}) {
  const { data: transactions, isLoading, error } = useTransactions(supabase, orgId, counterpartyId);

  const balances = useMemo(
    () => (transactions ? computeRunningBalance(transactions) : []),
    [transactions],
  );

  if (isLoading) return <p className="text-sm text-slate-500">Yuklanmoqda...</p>;
  if (error) return <p className="text-sm text-red-600">Xatolik: {(error as Error).message}</p>;

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-left text-slate-500">
          <th className="py-2 pr-4">Sana</th>
          <th className="py-2 pr-4">Operatsiya</th>
          <th className="py-2 pr-4 text-right">Debet</th>
          <th className="py-2 pr-4 text-right">Kredit</th>
          <th className="py-2 text-right">Saldo</th>
        </tr>
      </thead>
      <tbody>
        {transactions?.map((t, i) => {
          const balance = balances[i];
          return (
            <tr key={t.id} className="border-b border-slate-100">
              <td className="py-2 pr-4">{new Date(t.occurredAt).toLocaleDateString('uz-UZ')}</td>
              <td className="py-2 pr-4">
                {t.description}
                {t.quantity ? ` (${t.quantity} ${t.unit ?? ''})` : ''}
              </td>
              <td className="py-2 pr-4 text-right">
                {t.debitAccountType === 'receivable' ? currencyFormatter.format(t.debitAmount) : ''}
              </td>
              <td className="py-2 pr-4 text-right">
                {t.creditAccountType === 'receivable' ? currencyFormatter.format(t.creditAmount) : ''}
              </td>
              <td className="py-2 text-right font-medium">
                {balance ? (
                  <>
                    {currencyFormatter.format(balance.balance)}{' '}
                    <span className={balance.side === 'debit' ? 'text-emerald-600' : 'text-red-600'}>
                      {balance.side === 'debit' ? 'Д' : 'К'}
                    </span>
                  </>
                ) : null}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
