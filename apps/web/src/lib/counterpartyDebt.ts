import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@mubosher/api-client';
// Direct subpath import (not the package barrel) — the barrel also re-exports
// client-only hooks (useOrgOverview, which uses useEffect), which breaks when
// pulled into a Server Component like this file.
import { toLedgerTransaction } from '@mubosher/api-client/mappers';
import { getOverdueByCounterparty, type OverdueDebt } from '@mubosher/shared';

export type { OverdueDebt as CounterpartyDebt };

/**
 * Server-side wrapper around the shared `getOverdueByCounterparty`: fetches
 * accounts+transactions for the org, maps them, then defers to the same pure
 * logic the client-side analytics use. Powers the overdue badge on
 * counterparty cards in /clients and /dashboard/[category].
 */
export async function getOverdueDebts(
  supabase: SupabaseClient<Database>,
  orgId: string,
): Promise<Record<string, OverdueDebt>> {
  const [{ data: accounts }, { data: transactions }] = await Promise.all([
    supabase.from('accounts').select('*').eq('org_id', orgId),
    supabase.from('transactions').select('*').eq('org_id', orgId).not('due_date', 'is', null),
  ]);

  if (!transactions?.length) return {};

  const accountsById = new Map((accounts ?? []).map((a) => [a.id, a]));
  const ledgerTransactions = transactions.map((row) => toLedgerTransaction(row, accountsById));

  return getOverdueByCounterparty(ledgerTransactions, new Date());
}
