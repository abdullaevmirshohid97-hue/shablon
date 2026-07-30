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
      (client_local_id, org_id, counterparty_id, category_id, occurred_at, due_date, description,
       quantity, unit, quantity_kg, quantity_dona, amount, currency, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.clientLocalId,
      input.orgId,
      input.counterpartyId,
      input.categoryId,
      input.occurredAt,
      input.dueDate ?? null,
      input.description ?? null,
      input.quantity ?? null,
      input.unit ?? null,
      input.quantityKg ?? null,
      input.quantityDona ?? null,
      input.amount,
      input.currency,
      input.source,
    ],
  );
}

export interface PendingRow {
  client_local_id: string;
  org_id: string;
  counterparty_id: string;
  category_id: string;
  occurred_at: string;
  due_date: string | null;
  description: string | null;
  quantity: number | null;
  unit: string | null;
  quantity_kg: number | null;
  quantity_dona: number | null;
  amount: number;
  currency: string;
  source: 'fabrika' | 'shaxsiy';
  created_at: string;
  last_error: string | null;
  attempts: number;
  /** Set once the server refused the row for good — see markRowRejected. */
  rejected_at: string | null;
}

export interface SyncResult {
  synced: number;
  failed: number;
  /** Rows the server refused permanently — they left the retry queue. */
  rejected: number;
  /** Human-readable reason of the most recent failure, null when everything went through. */
  lastError: string | null;
}

async function markRowFailed(clientLocalId: string, message: string) {
  const db = await getLocalDb();
  await db.runAsync(
    'UPDATE pending_transactions SET last_error = ?, attempts = attempts + 1 WHERE client_local_id = ?',
    [message, clientLocalId],
  );
}

/**
 * Takes a row out of the retry loop without deleting it — the entry stays
 * visible so the person who typed it can see what happened and re-enter it
 * elsewhere, instead of it vanishing or being retried forever.
 */
async function markRowRejected(clientLocalId: string, message: string) {
  const db = await getLocalDb();
  await db.runAsync(
    "UPDATE pending_transactions SET rejected_at = datetime('now'), last_error = ? WHERE client_local_id = ?",
    [message, clientLocalId],
  );
}

/**
 * Postgres "insufficient privilege" — with Finance write now limited to
 * owner/admin (0012_finance_write_lock.sql), this is what a manager's queued
 * row comes back as. Retrying cannot change the outcome, so it is terminal.
 */
function isPermissionDenied(error: { code?: string; message?: string }): boolean {
  return error.code === '42501' || /row-level security/i.test(error.message ?? '');
}

const PERMISSION_MESSAGE =
  "Sizda yozuv kiritish huquqi yo'q — bu yozuv yuborilmadi. Administratorga murojaat qiling.";

let syncInFlight: Promise<SyncResult> | null = null;

/**
 * Pushes every unsynced row to Supabase. Uses upsert on `client_local_id`
 * so a retry after a partial failure never creates a duplicate ledger entry.
 * Every failure is recorded on the row (`last_error`) and reported back to
 * the caller — nothing is swallowed silently. Concurrent callers (several
 * screens each mounting useSyncQueue) share one in-flight pass.
 */
export function syncPendingTransactions(): Promise<SyncResult> {
  if (!syncInFlight) {
    syncInFlight = doSyncPass().finally(() => {
      syncInFlight = null;
    });
  }
  return syncInFlight;
}

async function doSyncPass(): Promise<SyncResult> {
  const db = await getLocalDb();
  const rows = await db.getAllAsync<PendingRow>(
    'SELECT * FROM pending_transactions WHERE synced_at IS NULL AND rejected_at IS NULL ORDER BY created_at',
  );

  if (rows.length === 0) return { synced: 0, failed: 0, rejected: 0, lastError: null };

  // Without a session every insert is rejected by RLS — surface that as one
  // clear message instead of a cryptic per-row policy error.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    const message = 'Tizimga kirilmagan — yozuvlar yuborilmaydi';
    for (const row of rows) await markRowFailed(row.client_local_id, message);
    return { synced: 0, failed: rows.length, rejected: 0, lastError: message };
  }

  let synced = 0;
  let failed = 0;
  let rejected = 0;
  let lastError: string | null = null;

  for (const row of rows) {
    const { data: category, error: categoryError } = await supabase
      .from('transaction_categories')
      .select('default_debit_account_id, default_credit_account_id')
      .eq('id', row.category_id)
      .single();

    if (
      categoryError ||
      !category?.default_debit_account_id ||
      !category?.default_credit_account_id
    ) {
      const message = categoryError
        ? `Kategoriya o'qilmadi: ${categoryError.message}`
        : 'Kategoriya uchun debet/kredit schyotlari sozlanmagan';
      await markRowFailed(row.client_local_id, message);
      failed += 1;
      lastError = message;
      continue;
    }

    const { error } = await supabase.from('transactions').upsert(
      {
        org_id: row.org_id,
        counterparty_id: row.counterparty_id,
        category_id: row.category_id,
        occurred_at: row.occurred_at,
        due_date: row.due_date,
        description: row.description,
        quantity: row.quantity,
        unit: row.unit,
        quantity_kg: row.quantity_kg,
        quantity_dona: row.quantity_dona,
        debit_account_id: category.default_debit_account_id,
        debit_amount: row.amount,
        credit_account_id: category.default_credit_account_id,
        credit_amount: row.amount,
        currency: row.currency,
        source: row.source,
        client_local_id: row.client_local_id,
      },
      { onConflict: 'client_local_id' },
    );

    if (error) {
      if (isPermissionDenied(error)) {
        await markRowRejected(row.client_local_id, PERMISSION_MESSAGE);
        rejected += 1;
        lastError = PERMISSION_MESSAGE;
        continue;
      }
      await markRowFailed(row.client_local_id, error.message);
      failed += 1;
      lastError = error.message;
      continue;
    }

    await db.runAsync('DELETE FROM pending_transactions WHERE client_local_id = ?', [
      row.client_local_id,
    ]);
    synced += 1;
  }

  return { synced, failed, rejected, lastError };
}

/** Rows still queued for retry — rejected ones are excluded, they will never go through. */
export async function getPendingCount(): Promise<number> {
  const db = await getLocalDb();
  const result = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM pending_transactions WHERE synced_at IS NULL AND rejected_at IS NULL',
  );
  return result?.count ?? 0;
}

/**
 * Unsent rows for one counterparty — both the ones still queued ("kutilmoqda")
 * and the permanently rejected ones, which the screen shows separately so a
 * refused entry isn't mistaken for one that is still on its way.
 */
export async function getPendingForCounterparty(counterpartyId: string): Promise<PendingRow[]> {
  const db = await getLocalDb();
  return db.getAllAsync<PendingRow>(
    'SELECT * FROM pending_transactions WHERE synced_at IS NULL AND counterparty_id = ? ORDER BY created_at DESC',
    [counterpartyId],
  );
}

/** Removes a queued or rejected row for good — the only way a rejected entry leaves the device. */
export async function discardPendingTransaction(clientLocalId: string): Promise<void> {
  const db = await getLocalDb();
  await db.runAsync('DELETE FROM pending_transactions WHERE client_local_id = ?', [clientLocalId]);
}
