import type { LedgerTransaction, RunningBalanceEntry } from './types';

/**
 * Recomputes the running balance ("Текущее сальдо" Д/К) for a counterparty's
 * transaction history, mirroring the source paper/1C ledger: only the
 * 'receivable' side of each posting (debit or credit) moves the balance.
 * Debit-receivable increases what the counterparty owes; credit-receivable
 * decreases it. A negative accumulated total means the balance flips to the
 * credit side (the org owes the counterparty), matching the "К" marker.
 *
 * Transactions must already be in chronological order (occurredAt, then
 * insertion order) — the caller is expected to sort, since ties need a
 * stable secondary key (e.g. created_at) that isn't part of this type.
 */
export function computeRunningBalance(transactions: LedgerTransaction[]): RunningBalanceEntry[] {
  let running = 0;
  return transactions.map((t) => {
    const debitDelta = t.debitAccountType === 'receivable' ? t.debitAmount : 0;
    const creditDelta = t.creditAccountType === 'receivable' ? t.creditAmount : 0;
    running += debitDelta - creditDelta;

    return {
      transactionId: t.id,
      occurredAt: t.occurredAt,
      // Round to the cent: repeated float addition otherwise drifts
      // (e.g. 5456.27 - 2400 -> 3056.2700000000004).
      balance: Math.round(Math.abs(running) * 100) / 100,
      side: running >= 0 ? 'debit' : 'credit',
    };
  });
}
