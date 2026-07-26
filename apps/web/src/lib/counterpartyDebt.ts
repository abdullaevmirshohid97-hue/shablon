import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@mubosher/api-client';
// Direct subpath import (not the package barrel) — the barrel also re-exports
// client-only hooks (useOrgOverview, which uses useEffect), which breaks when
// pulled into a Server Component like this file.
import { toLedgerTransaction } from '@mubosher/api-client/mappers';

export interface CounterpartyDebt {
  /** Sum of overdue "chiqim" amounts (mirrors LedgerTable's per-row dueDateTone, not netted against the running balance). */
  overdueAmount: number;
  /** Earliest (oldest, most urgent) overdue due date. */
  overdueDate: string;
}

/**
 * Overdue "chiqim" total + earliest overdue date, per counterparty — same
 * convention LedgerTable already uses per-row (isChiqim = creditAccountType
 * === 'receivable', overdue = dueDate < today). Used to surface it on
 * counterparty cards in /clients and /dashboard/[category].
 */
export async function getOverdueDebts(
  supabase: SupabaseClient<Database>,
  orgId: string,
): Promise<Record<string, CounterpartyDebt>> {
  const [{ data: accounts }, { data: transactions }] = await Promise.all([
    supabase.from('accounts').select('*').eq('org_id', orgId),
    supabase.from('transactions').select('*').eq('org_id', orgId).not('due_date', 'is', null),
  ]);

  const result: Record<string, CounterpartyDebt> = {};
  if (!transactions?.length) return result;

  const accountsById = new Map((accounts ?? []).map((a) => [a.id, a]));
  const todayIso = new Date().toISOString().slice(0, 10);

  for (const row of transactions) {
    const tx = toLedgerTransaction(row, accountsById);
    if (tx.creditAccountType !== 'receivable' || !tx.dueDate || tx.dueDate >= todayIso) continue;

    const existing = result[tx.counterpartyId];
    result[tx.counterpartyId] = {
      overdueAmount: (existing?.overdueAmount ?? 0) + tx.creditAmount,
      overdueDate: existing
        ? tx.dueDate < existing.overdueDate
          ? tx.dueDate
          : existing.overdueDate
        : tx.dueDate,
    };
  }

  return result;
}
