import { describe, expect, it } from 'vitest';
import {
  computePeriodStats,
  getDueSoonAndOverdue,
  getOverdueByCounterparty,
  getPeriodRange,
} from './analytics';
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

describe('getPeriodRange', () => {
  it('resolves a calendar month', () => {
    const range = getPeriodRange('month', new Date('2026-02-15T00:00:00Z'));
    expect(range).toEqual({ start: '2026-02-01', end: '2026-02-28' });
  });

  it('resolves a quarter', () => {
    const range = getPeriodRange('quarter', new Date('2026-05-10T00:00:00Z'));
    expect(range).toEqual({ start: '2026-04-01', end: '2026-06-30' });
  });

  it('resolves a year', () => {
    const range = getPeriodRange('year', new Date('2026-05-10T00:00:00Z'));
    expect(range).toEqual({ start: '2026-01-01', end: '2026-12-31' });
  });

  it('passes through a custom range unchanged', () => {
    const range = getPeriodRange('custom', new Date(), { start: '2026-03-01', end: '2026-03-10' });
    expect(range).toEqual({ start: '2026-03-01', end: '2026-03-10' });
  });
});

describe('computePeriodStats', () => {
  it('sums kirim/chiqim money and quantity per category+unit within the period, mirroring "10000 kg sochiq"', () => {
    const stats = computePeriodStats(
      [
        tx({
          id: 't1',
          occurredAt: '2026-02-05T00:00:00Z',
          debitAccountType: 'receivable',
          debitAmount: 2554,
          quantity: 6000,
          unit: 'kg',
          categoryName: 'Sochiq',
        }),
        tx({
          id: 't2',
          occurredAt: '2026-02-20T00:00:00Z',
          debitAccountType: 'receivable',
          debitAmount: 1200,
          quantity: 4000,
          unit: 'kg',
          categoryName: 'Sochiq',
        }),
        tx({
          id: 't3',
          occurredAt: '2026-02-10T00:00:00Z',
          creditAccountType: 'receivable',
          creditAmount: 900,
        }),
        // Outside the period — must not be counted.
        tx({
          id: 't4',
          occurredAt: '2026-03-01T00:00:00Z',
          debitAccountType: 'receivable',
          debitAmount: 500,
          quantity: 999,
          unit: 'kg',
          categoryName: 'Sochiq',
        }),
      ],
      { start: '2026-02-01', end: '2026-02-28' },
    );

    expect(stats.totalKirim).toBe(3754);
    expect(stats.totalChiqim).toBe(900);
    expect(stats.net).toBe(2854);
    expect(stats.transactionCount).toBe(3);

    const sochiq = stats.byCategory.find((c) => c.categoryName === 'Sochiq');
    expect(sochiq).toMatchObject({
      totalQuantity: 10000,
      unit: 'kg',
      totalAmount: 3754,
      transactionCount: 2,
    });
  });
});

describe('getDueSoonAndOverdue', () => {
  it('splits transactions into overdue and due-within-the-window buckets', () => {
    const today = new Date('2026-02-15T00:00:00Z');
    const { overdue, dueSoon } = getDueSoonAndOverdue(
      [
        tx({ id: 'past', occurredAt: '2026-01-01T00:00:00Z', dueDate: '2026-02-01' }),
        tx({ id: 'soon', occurredAt: '2026-01-01T00:00:00Z', dueDate: '2026-02-18' }),
        tx({ id: 'far', occurredAt: '2026-01-01T00:00:00Z', dueDate: '2026-03-01' }),
        tx({ id: 'none', occurredAt: '2026-01-01T00:00:00Z' }),
      ],
      today,
      7,
    );

    expect(overdue.map((t) => t.id)).toEqual(['past']);
    expect(dueSoon.map((t) => t.id)).toEqual(['soon']);
  });
});

describe('getOverdueByCounterparty', () => {
  const today = new Date('2026-07-26T00:00:00Z');

  it('sums overdue "chiqim" amounts per counterparty and keeps the earliest due date', () => {
    const result = getOverdueByCounterparty(
      [
        // cp-1: two overdue chiqim legs — amounts sum, earliest date wins.
        tx({
          id: 't1',
          counterpartyId: 'cp-1',
          occurredAt: '2026-07-01T00:00:00Z',
          creditAccountType: 'receivable',
          creditAmount: 3600,
          dueDate: '2026-07-25',
        }),
        tx({
          id: 't2',
          counterpartyId: 'cp-1',
          occurredAt: '2026-07-10T00:00:00Z',
          creditAccountType: 'receivable',
          creditAmount: 1500,
          dueDate: '2026-07-20',
        }),
        // cp-2: due today — not yet overdue (dueDate < today, not <=).
        tx({
          id: 't3',
          counterpartyId: 'cp-2',
          occurredAt: '2026-07-01T00:00:00Z',
          creditAccountType: 'receivable',
          creditAmount: 5000,
          dueDate: '2026-07-26',
        }),
        // cp-3: overdue date, but debitAccountType is the receivable side (a
        // "kirim" leg, new debt created) — must not count as overdue chiqim.
        tx({
          id: 't4',
          counterpartyId: 'cp-3',
          occurredAt: '2026-07-01T00:00:00Z',
          debitAccountType: 'receivable',
          debitAmount: 2000,
          dueDate: '2026-07-01',
        }),
      ],
      today,
    );

    expect(result['cp-1']).toEqual({ overdueAmount: 5100, overdueDate: '2026-07-20' });
    expect(result['cp-2']).toBeUndefined();
    expect(result['cp-3']).toBeUndefined();
  });

  it('returns an empty map when nothing is overdue', () => {
    expect(
      getOverdueByCounterparty([tx({ id: 't1', occurredAt: '2026-07-01T00:00:00Z' })], today),
    ).toEqual({});
  });
});
