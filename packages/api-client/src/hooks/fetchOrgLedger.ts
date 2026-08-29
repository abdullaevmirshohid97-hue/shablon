import type { SupabaseClient } from '@supabase/supabase-js';
import type { Counterparty, LedgerTransaction } from '@mubosher/shared';
import type { Database } from '../database.types';
import { toLedgerTransaction, toCounterparty } from '../mappers';
import { fetchAllRows } from '../paginate';

export interface OrgLedger {
  /** Every client in scope, archived ones included — see below. */
  counterparties: Counterparty[];
  transactions: LedgerTransaction[];
}

/**
 * The org's full ledger, entries and all.
 *
 * Nothing renders from this any more — the dashboard reads aggregates from
 * Postgres (useOrgReport). It exists for the one job that genuinely needs
 * every row: building the multi-sheet Excel report. Called on demand, when
 * the button is pressed, rather than on every page view.
 *
 * "Every row" is meant literally: both reads page to the end (see
 * `fetchAllRows`). A single `select()` stops at the project's max-rows and
 * reports no error, which had this handing back a truncated ledger that the
 * report then presented as the complete one.
 *
 * Archived clients come back too, flagged by `archivedAt`, and the caller
 * decides. Filtering them out here meant a client who was put away still owing
 * money vanished from the org's own report of what it is owed.
 */
export async function fetchOrgLedger(
  supabase: SupabaseClient<Database>,
  orgId: string,
  categoryFilter?: string,
): Promise<OrgLedger> {
  const [counterparties, accounts, categories, txs] = await Promise.all([
    fetchAllRows((from, to) =>
      supabase
        .from('counterparties')
        .select(
          'id, org_id, name, phone, categories, notes, currency, manager_id, archived_at, archived_by, created_at',
        )
        .eq('org_id', orgId)
        .order('name')
        .range(from, to),
    ),
    fetchAllRows((from, to) =>
      supabase.from('accounts').select('*').eq('org_id', orgId).order('id').range(from, to),
    ),
    fetchAllRows((from, to) =>
      supabase
        .from('transaction_categories')
        .select('*')
        .eq('org_id', orgId)
        .order('id')
        .range(from, to),
    ),
    fetchAllRows((from, to) =>
      supabase
        .from('transactions')
        .select('*')
        .eq('org_id', orgId)
        .order('occurred_at')
        .order('created_at')
        .range(from, to),
    ),
  ]);

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
