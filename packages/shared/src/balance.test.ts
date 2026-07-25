import { describe, expect, it } from 'vitest';
import { computeRunningBalance, computeSourceBalances } from './balance';
import type { LedgerTransaction } from './types';

function tx(
  partial: Partial<LedgerTransaction> & Pick<LedgerTransaction, 'id' | 'occurredAt'>,
): LedgerTransaction {
  return {
    orgId: 'org-1',
    counterpartyId: 'cp-1',
    debitAccountType: 'other',
    debitAmount: 0,
    creditAccountType: 'other',
    creditAmount: 0,
    currency: 'UZS',
    source: 'fabrika',
    ...partial,
  };
}

describe('computeRunningBalance', () => {
  it('starts from an opening debit balance', () => {
    const [entry] = computeRunningBalance([
      tx({
        id: 't1',
        occurredAt: '2025-12-31T00:00:00Z',
        debitAccountType: 'receivable',
        debitAmount: 502.27,
      }),
    ]);

    expect(entry).toMatchObject({ balance: 502.27, side: 'debit' });
  });

  it('reproduces the sample ledger sequence (sale then cash payment)', () => {
    // Mirrors the first rows of the source "Мубошер" ledger:
    // opening 502.27 Д -> +2554 sale -> +2400 sale -> -2400 cash payment
    const entries = computeRunningBalance([
      tx({
        id: 'opening',
        occurredAt: '2025-12-31T00:00:00Z',
        debitAccountType: 'receivable',
        debitAmount: 502.27,
      }),
      tx({
        id: 'sale-412kg',
        occurredAt: '2026-01-05T17:17:49Z',
        debitAccountType: 'receivable',
        debitAmount: 2554.0,
      }),
      tx({
        id: 'sale-230kg',
        occurredAt: '2026-01-05T17:18:00Z',
        debitAccountType: 'receivable',
        debitAmount: 2400.0,
      }),
      tx({
        id: 'cash-payment',
        occurredAt: '2026-01-06T16:27:55Z',
        creditAccountType: 'receivable',
        creditAmount: 2400.0,
      }),
    ]);

    expect(entries.map((e) => e.balance)).toEqual([502.27, 3056.27, 5456.27, 3056.27]);
    expect(entries.every((e) => e.side === 'debit')).toBe(true);
  });

  it('flips to the credit side when the counterparty is overpaid', () => {
    const entries = computeRunningBalance([
      tx({
        id: 'sale',
        occurredAt: '2026-01-01T00:00:00Z',
        debitAccountType: 'receivable',
        debitAmount: 1100.0,
      }),
      tx({
        id: 'overpayment',
        occurredAt: '2026-01-02T00:00:00Z',
        creditAccountType: 'receivable',
        creditAmount: 1193.73,
      }),
    ]);

    expect(entries[1]).toMatchObject({ balance: expect.closeTo(93.73, 2), side: 'credit' });
  });

  it('ignores non-receivable postings (e.g. cash-only or inventory legs)', () => {
    const entries = computeRunningBalance([
      tx({
        id: 'warehouse-issue',
        occurredAt: '2026-01-01T00:00:00Z',
        debitAccountType: 'other',
        debitAmount: 38.0,
        creditAccountType: 'inventory',
        creditAmount: 38.0,
      }),
    ]);

    expect(entries[0]).toMatchObject({ balance: 0, side: 'debit' });
  });
});

describe('computeSourceBalances', () => {
  it('keeps fabrika and shaxsiy totals independent', () => {
    const entries = computeSourceBalances([
      tx({
        id: 'sale-fabrika',
        occurredAt: '2026-01-01T00:00:00Z',
        debitAccountType: 'receivable',
        debitAmount: 1000,
        source: 'fabrika',
      }),
      tx({
        id: 'sale-shaxsiy',
        occurredAt: '2026-01-02T00:00:00Z',
        debitAccountType: 'receivable',
        debitAmount: 300,
        source: 'shaxsiy',
      }),
      tx({
        id: 'payment-fabrika',
        occurredAt: '2026-01-03T00:00:00Z',
        creditAccountType: 'receivable',
        creditAmount: 400,
        source: 'fabrika',
      }),
    ]);

    // Fabrika: +1000 jami, then +400 jami (gross) = 1400; net qoldi = 1000 - 400 = 600.
    expect(entries[2]).toMatchObject({
      fabrikaJami: 1400,
      fabrikaQoldi: 600,
      shaxsiyJami: 300,
      shaxsiyQoldi: 300,
    });
    // Shaxsiy untouched by the fabrika payment.
    expect(entries[1]).toMatchObject({ shaxsiyJami: 300, shaxsiyQoldi: 300 });
  });

  it('ignores non-receivable postings for both sources', () => {
    const [entry] = computeSourceBalances([
      tx({
        id: 'warehouse-issue',
        occurredAt: '2026-01-01T00:00:00Z',
        debitAccountType: 'other',
        debitAmount: 38,
        creditAccountType: 'inventory',
        creditAmount: 38,
        source: 'fabrika',
      }),
    ]);

    expect(entry).toMatchObject({
      fabrikaJami: 0,
      fabrikaQoldi: 0,
      shaxsiyJami: 0,
      shaxsiyQoldi: 0,
    });
  });
});
