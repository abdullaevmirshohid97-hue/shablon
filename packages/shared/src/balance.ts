import type { LedgerTransaction, RunningBalanceEntry, SourceBalanceEntry } from './types';
import { baseLegs, isPostedEntry } from './statement';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Recomputes the running balance ("Текущее сальдо" Д/К) for a counterparty's
 * transaction history, mirroring the source paper/1C ledger: only the
 * 'receivable' side of each posting (debit or credit) moves the balance.
 * Debit-receivable increases what the counterparty owes; credit-receivable
 * decreases it. A negative accumulated total means the balance flips to the
 * credit side (the org owes the counterparty), matching the "К" marker.
 *
 * Amounts are the base-currency ones, and drafts do not move the balance —
 * both so that this column agrees with the dashboard, which has always been
 * summed that way in Postgres. A draft still gets an entry, carrying the
 * balance it did not change and marked `counted: false`, so the ledger can
 * show the row without implying it counted.
 *
 * Transactions must already be in chronological order (occurredAt, then
 * insertion order) — the caller is expected to sort, since ties need a
 * stable secondary key (e.g. created_at) that isn't part of this type.
 */
export function computeRunningBalance(transactions: LedgerTransaction[]): RunningBalanceEntry[] {
  let running = 0;
  return transactions.map((t) => {
    const counted = isPostedEntry(t);
    if (counted) {
      const { debit, credit } = baseLegs(t);
      running += debit - credit;
    }

    return {
      transactionId: t.id,
      occurredAt: t.occurredAt,
      // Round to the cent: repeated float addition otherwise drifts
      // (e.g. 5456.27 - 2400 -> 3056.2700000000004).
      balance: round2(Math.abs(running)),
      side: running >= 0 ? 'debit' : 'credit',
      counted,
    };
  });
}

/**
 * Per-row Jami (Fabrika/Shaxsiy) and Qoldi (Fabrika/Shaxsiy): the same
 * receivable-side amount used by computeRunningBalance, but tracked as two
 * independent running totals split by `source`. Jami is gross turnover
 * (every amount added, regardless of kirim/chiqim); Qoldi is the net
 * balance (kirim minus chiqim) for that source only.
 */
export function computeSourceBalances(transactions: LedgerTransaction[]): SourceBalanceEntry[] {
  let fabrikaJami = 0;
  let shaxsiyJami = 0;
  let fabrikaQoldi = 0;
  let shaxsiyQoldi = 0;

  return transactions.map((t) => {
    const debitDelta = t.debitAccountType === 'receivable' ? t.debitAmount : 0;
    const creditDelta = t.creditAccountType === 'receivable' ? t.creditAmount : 0;
    const amount = debitDelta + creditDelta;
    const net = debitDelta - creditDelta;

    if (t.source === 'fabrika') {
      fabrikaJami += amount;
      fabrikaQoldi += net;
    } else {
      shaxsiyJami += amount;
      shaxsiyQoldi += net;
    }

    return {
      transactionId: t.id,
      fabrikaJami: round2(fabrikaJami),
      shaxsiyJami: round2(shaxsiyJami),
      fabrikaQoldi: round2(fabrikaQoldi),
      shaxsiyQoldi: round2(shaxsiyQoldi),
    };
  });
}
