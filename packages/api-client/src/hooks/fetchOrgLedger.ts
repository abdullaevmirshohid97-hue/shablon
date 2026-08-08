import type { SupabaseClient } from '@supabase/supabase-js';
import type { Counterparty, LedgerTransaction } from '@mubosher/shared';
import type { Database } from '../database.types';
import { toLedgerTransaction, toCounterparty } from '../mappers';

/**
 * The org's full ledger, entries and all.
 *
 * Nothing renders from this any more — the dashboard reads aggregates from
 * Postgres (useOrgReport). It exists for the one job that genuinely needs
 * every row: building the multi-sheet Excel report. Called on demand, when
 * the button is pressed, rather than on every page view.
 */
export async function fetchOrgLedger(
  supabase: SupabaseClient<Database>,
  orgId: string,
  categoryFilter?: string,
): Promise<{ counterparties: Counterparty[]; transactions: LedgerTransaction[] }> {
  const [
    { data: counterparties, error: counterpartiesError },
    { data: accounts, error: accountsError },
    { data: categories, error: categoriesError },
    { data: txs, error: txError },
  ] = await Promise.all([
    supabase
      .from('counterparties')
      .select('id, org_id, name, phone, categories, notes, currency, manager_id, created_at')
      .eq('org_id', orgId),
    supabase.from('accounts').select('*').eq('org_id', orgId),
    supabase.from('transaction_categories').select('*').eq('org_id', orgId),
    supabase
      .from('transactions')
      .select('*')
      .eq('org_id', orgId)
      .order('occurred_at')
      .order('created_at'),
  ]);

  if (counterpartiesError) throw counterpartiesError;
  if (accountsError) throw accountsError;
  if (categoriesError) throw categoriesError;
  if (txError) throw txError;

  const accountsById = new Map(accounts.map((a) => [a.id, a]));
  const categoriesById = new Map(categories.map((c) => [c.id, c]));

  const scoped = categoryFilter
    ? counterparties.filter((c) => c.categories?.includes(categoryFilter))
    : counterparties;
  const ids = new Set(scoped.map((c) => c.id));

  return {
    counterparties: scoped.map(toCounterparty),
    transactions: txs
      .filter((t) => ids.has(t.counterparty_id))
      .map((t) => toLedgerTransaction(t, accountsById, categoriesById)),
  };
}
