import { toLedgerTransaction } from '@mubosher/api-client';
import type { LedgerTransaction } from '@mubosher/shared';
import { supabase } from '../supabase';
import { getLocalDb } from '../db/localDb';

export interface LedgerLoadResult {
  transactions: LedgerTransaction[];
  /** True when the server was unreachable and the list came from SQLite. */
  fromCache: boolean;
}

/**
 * Loads a counterparty's full ledger (transactions joined with account
 * types, chronological), the same shape the web ledger uses, and mirrors it
 * into SQLite so the history stays readable offline.
 */
export async function loadLedger(orgId: string, counterpartyId: string): Promise<LedgerLoadResult> {
  const db = await getLocalDb();

  const [
    { data: accounts, error: accountsError },
    { data: categories, error: categoriesError },
    { data: txs, error: txError },
  ] = await Promise.all([
    supabase.from('accounts').select('*').eq('org_id', orgId),
    supabase.from('transaction_categories').select('*').eq('org_id', orgId),
    supabase
      .from('transactions')
      .select('*')
      .eq('counterparty_id', counterpartyId)
      .order('occurred_at')
      .order('created_at'),
  ]);

  if (accountsError || categoriesError || txError || !accounts || !categories || !txs) {
    const cached = await db.getAllAsync<{ payload: string }>(
      'SELECT payload FROM cached_transactions WHERE counterparty_id = ? ORDER BY occurred_at',
      [counterpartyId],
    );
    return {
      transactions: cached.map((row) => JSON.parse(row.payload) as LedgerTransaction),
      fromCache: true,
    };
  }

  const accountsById = new Map(accounts.map((a) => [a.id, a]));
  const categoriesById = new Map(categories.map((c) => [c.id, c]));
  const transactions = txs.map((t) => toLedgerTransaction(t, accountsById, categoriesById));

  // Replace the cache wholesale so edits/deletes made on web don't linger.
  await db.runAsync('DELETE FROM cached_transactions WHERE counterparty_id = ?', [counterpartyId]);
  for (const t of transactions) {
    await db.runAsync(
      'INSERT OR REPLACE INTO cached_transactions (id, counterparty_id, occurred_at, payload) VALUES (?, ?, ?, ?)',
      [t.id, counterpartyId, t.occurredAt, JSON.stringify(t)],
    );
  }

  return { transactions, fromCache: false };
}
