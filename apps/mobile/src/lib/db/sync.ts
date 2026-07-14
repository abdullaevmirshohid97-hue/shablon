import type { TransactionInput } from '@mubosher/shared';
import { supabase } from '../supabase';
import { getLocalDb } from './localDb';

/**
 * Writes a transaction to the local queue immediately — the entry form
 * never blocks on network. `syncPendingTransactions` drains the queue
 * whenever connectivity is available (see useSyncQueue).
 */
export async function enqueueTransaction(input: TransactionInput) {
  const db = await getLocalDb();
  await db.runAsync(
    `INSERT INTO pending_transactions
      (client_local_id, org_id, counterparty_id, category_id, occurred_at, description, quantity, unit, amount, currency)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.clientLocalId,
      input.orgId,
      input.counterpartyId,
      input.categoryId,
      input.occurredAt,
      input.description ?? null,
      input.quantity ?? null,
      input.unit ?? null,
      input.amount,
      input.currency,
    ],
  );
}

interface PendingRow {
  client_local_id: string;
  org_id: string;
  counterparty_id: string;
  category_id: string;
  occurred_at: string;
  description: string | null;
  quantity: number | null;
  unit: string | null;
  amount: number;
  currency: string;
}

/**
 * Pushes every unsynced row to Supabase. Uses upsert on `client_local_id`
 * so a retry after a partial failure never creates a duplicate ledger entry.
 * Returns the number of rows successfully synced.
 */
export async function syncPendingTransactions(): Promise<number> {
  const db = await getLocalDb();
  const rows = await db.getAllAsync<PendingRow>(
    'SELECT * FROM pending_transactions WHERE synced_at IS NULL ORDER BY created_at',
  );

  let syncedCount = 0;

  for (const row of rows) {
    const { data: category, error: categoryError } = await supabase
      .from('transaction_categories')
      .select('default_debit_account_id, default_credit_account_id')
      .eq('id', row.category_id)
      .single();

    if (categoryError || !category?.default_debit_account_id || !category?.default_credit_account_id) {
      continue; // leave in queue, retry next sync pass
    }

    const { error } = await supabase.from('transactions').upsert(
      {
        org_id: row.org_id,
        counterparty_id: row.counterparty_id,
        category_id: row.category_id,
        occurred_at: row.occurred_at,
        description: row.description,
        quantity: row.quantity,
        unit: row.unit,
        debit_account_id: category.default_debit_account_id,
        debit_amount: row.amount,
        credit_account_id: category.default_credit_account_id,
        credit_amount: row.amount,
        currency: row.currency,
        client_local_id: row.client_local_id,
      },
      { onConflict: 'client_local_id' },
    );

    if (!error) {
      await db.runAsync('DELETE FROM pending_transactions WHERE client_local_id = ?', [
        row.client_local_id,
      ]);
      syncedCount += 1;
    }
  }

  return syncedCount;
}

export async function getPendingCount(): Promise<number> {
  const db = await getLocalDb();
  const result = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM pending_transactions WHERE synced_at IS NULL',
  );
  return result?.count ?? 0;
}
