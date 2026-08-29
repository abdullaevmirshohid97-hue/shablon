import { describe, expect, it } from 'vitest';
import { buildStatement, buildStatements } from './statement';
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
    status: 'posted',
    ...partial,
  };
}

/** A sale on credit: the client owes this much more. */
function sale(
  id: string,
  occurredAt: string,
  amount: number,
  extra: Partial<LedgerTransaction> = {},
) {
  return tx({ id, occurredAt, debitAccountType: 'receivable', debitAmount: amount, ...extra });
}

/** A payment: the client owes this much less. Only this leg carries a deadline. */
function payment(
  id: string,
  occurredAt: string,
  amount: number,
  extra: Partial<LedgerTransaction> = {},
) {
  return tx({ id, occurredAt, creditAccountType: 'receivable', creditAmount: amount, ...extra });
}

const today = new Date('2026-03-15T00:00:00Z');

describe('buildStatement — balances', () => {
  it('carries the pre-period balance in rather than restarting at zero', () => {
    const statement = buildStatement(
      [
        sale('before', '2026-01-05T00:00:00Z', 1000),
        sale('inside', '2026-02-10T00:00:00Z', 400),
        payment('inside-2', '2026-02-20T00:00:00Z', 300),
      ],
      { range: { start: '2026-02-01', end: '2026-02-28' }, today },
    );

    expect(statement.openingBalance).toBe(1000);
    expect(statement.debitTurnover).toBe(400);
    expect(statement.creditTurnover).toBe(300);
    expect(statement.netChange).toBe(100);
    expect(statement.closingBalance).toBe(1100);
    // Only the two in-period rows are listed; the carried-in one is a figure.
    expect(statement.lines.map((l) => l.transactionId)).toEqual(['inside', 'inside-2']);
    expect(statement.lines.map((l) => l.balanceAfter)).toEqual([1400, 1100]);
  });

  it('closes at the period end, not at today', () => {
    const statement = buildStatement(
      [sale('in', '2026-01-10T00:00:00Z', 500), sale('after', '2026-02-10T00:00:00Z', 900)],
      { range: { start: '2026-01-01', end: '2026-01-31' }, today },
    );

    expect(statement.closingBalance).toBe(500);
    expect(statement.asOf).toBe('2026-01-31');
    expect(statement.lines).toHaveLength(1);
  });

  it('dates an unfinished period at today, so nothing inside it reads as already late', () => {
    const statement = buildStatement([sale('s', '2026-03-01T00:00:00Z', 100)], {
      range: { start: '2026-03-01', end: '2026-03-31' },
      today,
    });

    expect(statement.asOf).toBe('2026-03-15');
  });

  it('reports a credit balance as an advance rather than a negative debt', () => {
    const statement = buildStatement(
      [sale('s', '2026-01-01T00:00:00Z', 1000), payment('p', '2026-01-05T00:00:00Z', 1250)],
      { today },
    );

    expect(statement.closingBalance).toBe(-250);
    expect(statement.totalDebt).toBe(0);
    expect(statement.advance).toBe(250);
    expect(statement.overdueAmount).toBe(0);
  });
});

describe('buildStatement — what counts', () => {
  it('lists a draft but never lets it move a figure', () => {
    const statement = buildStatement(
      [
        sale('posted', '2026-01-01T00:00:00Z', 1000),
        sale('draft', '2026-01-02T00:00:00Z', 5000, { status: 'draft' }),
      ],
      { today },
    );

    expect(statement.draftCount).toBe(1);
    expect(statement.debitTurnover).toBe(1000);
    expect(statement.closingBalance).toBe(1000);

    const draftLine = statement.lines.find((l) => l.transactionId === 'draft')!;
    expect(draftLine.counted).toBe(false);
    expect(draftLine.baseDebit).toBe(0);
    expect(draftLine.balanceAfter).toBe(1000);
  });

  it('keeps a reversal and the entry it cancels, and nets them to nothing', () => {
    const statement = buildStatement(
      [
        sale('wrong', '2026-01-01T00:00:00Z', 700, { status: 'reversed' }),
        payment('mirror', '2026-01-02T00:00:00Z', 700, { status: 'reversal' }),
      ],
      { today },
    );

    expect(statement.closingBalance).toBe(0);
    expect(statement.reversedCount).toBe(2);
    expect(statement.lines.map((l) => l.status)).toEqual(['reversed', 'reversal']);
  });

  it('totals the base-currency amounts, not the amounts as entered', () => {
    const statement = buildStatement(
      [
        sale('usd', '2026-01-01T00:00:00Z', 100, {
          currency: 'USD',
          exchangeRate: 12500,
          baseDebitAmount: 1_250_000,
        }),
        sale('uzs', '2026-01-02T00:00:00Z', 250_000, { baseDebitAmount: 250_000 }),
      ],
      { today },
    );

    expect(statement.debitTurnover).toBe(1_500_000);
    expect(statement.closingBalance).toBe(1_500_000);
    expect(statement.currencies).toEqual(['USD', 'UZS']);

    const usd = statement.lines[0]!;
    expect(usd.debit).toBe(100);
    expect(usd.baseDebit).toBe(1_250_000);
    expect(usd.exchangeRate).toBe(12500);
  });

  it('falls back to the raw amount on rows written before base amounts existed', () => {
    const statement = buildStatement([sale('legacy', '2026-01-01T00:00:00Z', 4321)], { today });

    expect(statement.closingBalance).toBe(4321);
    expect(statement.lines[0]!.exchangeRate).toBe(1);
  });
});

describe('buildStatement — aging', () => {
  const history = [
    sale('sale-1', '2026-01-01T00:00:00Z', 1000),
    payment('due-1', '2026-02-01T00:00:00Z', 400, { dueDate: '2026-02-01' }),
  ];

  it('reports what was outstanding when the deadline passed', () => {
    const statement = buildStatement(history, { today });

    expect(statement.overdueDate).toBe('2026-02-01');
    expect(statement.overdueAmount).toBe(600);
    expect(statement.totalDebt).toBe(600);
    expect(statement.notYetDue).toBe(0);
  });

  it('lets a later payment bring the overdue figure down', () => {
    const statement = buildStatement([...history, payment('later', '2026-03-01T00:00:00Z', 200)], {
      today,
    });

    expect(statement.closingBalance).toBe(400);
    expect(statement.overdueAmount).toBe(400);
  });

  it('does not let a new sale inflate what is past due', () => {
    const statement = buildStatement(
      [
        ...history,
        payment('later', '2026-03-01T00:00:00Z', 200),
        sale('new', '2026-03-10T00:00:00Z', 500),
      ],
      { today },
    );

    expect(statement.closingBalance).toBe(900);
    expect(statement.overdueAmount).toBe(400);
    expect(statement.notYetDue).toBe(500);
  });

  it('puts the debt in the bucket matching how long it has been late', () => {
    const statement = buildStatement(history, { today });
    // 2026-02-01 is 42 days before 2026-03-15.
    const buckets = statement.aging.map((b) => b.amount);

    expect(buckets).toEqual([0, 600, 0, 0]);
    expect(buckets.reduce((a, b) => a + b, 0)).toBe(statement.overdueAmount);
  });

  it('counts every deadline that has passed, not only the first', () => {
    const statement = buildStatement(
      [
        sale('old', '2026-01-05T00:00:00Z', 1000, { dueDate: '2026-01-31' }),
        sale('recent', '2026-03-05T00:00:00Z', 500, { dueDate: '2026-03-10' }),
      ],
      { today },
    );

    // Measured from the newest deadline that has gone by. Measuring from the
    // oldest — which is what the SQL did before 0038 — would have reported
    // 1000 and treated the March debt as though its day had not come.
    expect(statement.overdueAmount).toBe(1500);
    expect(statement.overdueDate).toBe('2026-01-31');
    expect(statement.notYetDue).toBe(0);
  });

  it('sorts each slice into the bucket for how long it has been late', () => {
    const statement = buildStatement(
      [
        sale('old', '2026-01-05T00:00:00Z', 1000, { dueDate: '2026-01-31' }),
        sale('recent', '2026-03-05T00:00:00Z', 500, { dueDate: '2026-03-10' }),
      ],
      { today },
    );

    // 2026-01-31 is 43 days back, 2026-03-10 is 5.
    expect(statement.aging.map((b) => b.amount)).toEqual([500, 1000, 0, 0]);
  });

  it('settles the oldest bucket first when a payment lands', () => {
    const statement = buildStatement(
      [
        sale('oldest', '2025-12-01T00:00:00Z', 1000, { dueDate: '2025-12-10' }),
        sale('middle', '2026-01-20T00:00:00Z', 500, { dueDate: '2026-01-31' }),
        sale('newest', '2026-03-05T00:00:00Z', 300, { dueDate: '2026-03-10' }),
        payment('paid', '2026-03-14T00:00:00Z', 1200),
      ],
      { today },
    );

    expect(statement.closingBalance).toBe(600);
    expect(statement.overdueAmount).toBe(600);
    // 1200 against 1000 / 500 / 300 oldest-first: the two oldest buckets are
    // cleared or eaten into, the newest is untouched.
    expect(statement.aging.map((b) => b.amount)).toEqual([300, 300, 0, 0]);
  });

  it('does not let cancelling a mistyped entry settle the oldest debt', () => {
    const statement = buildStatement(
      [
        ...history,
        sale('typo', '2026-03-01T00:00:00Z', 900, { status: 'reversed' }),
        payment('storno', '2026-03-02T00:00:00Z', 900, { status: 'reversal' }),
      ],
      { today },
    );

    // The pair nets to nothing on both figures. Counting the storno's mirror
    // leg as a payment would have knocked 900 off what is past due.
    expect(statement.closingBalance).toBe(600);
    expect(statement.overdueAmount).toBe(600);
  });

  it('drops anyone who has settled, whatever the dates say', () => {
    const statement = buildStatement(
      [...history, payment('cleared', '2026-03-02T00:00:00Z', 600)],
      { today },
    );

    expect(statement.closingBalance).toBe(0);
    expect(statement.overdueAmount).toBe(0);
    expect(statement.aging.every((b) => b.amount === 0)).toBe(true);
  });

  it('reports the nearest deadline still ahead separately from the ones missed', () => {
    // Booked today, falling due next week — which is how a deadline is
    // actually recorded, rather than as a row dated in the future.
    const statement = buildStatement(
      [...history, payment('upcoming', '2026-03-10T00:00:00Z', 100, { dueDate: '2026-03-20' })],
      { today },
    );

    expect(statement.overdueDate).toBe('2026-02-01');
    expect(statement.nextDueDate).toBe('2026-03-20');
  });
});

describe('buildStatements', () => {
  it('gives every client their own statement from one pass over the ledger', () => {
    const rows = buildStatements(
      [
        { id: 'cp-1', name: 'Alfa' },
        { id: 'cp-2', name: 'Beta' },
        { id: 'cp-3', name: 'Gamma' },
      ],
      [
        sale('a', '2026-01-01T00:00:00Z', 100, { counterpartyId: 'cp-1' }),
        sale('b', '2026-01-02T00:00:00Z', 250, { counterpartyId: 'cp-2' }),
        payment('c', '2026-01-03T00:00:00Z', 50, { counterpartyId: 'cp-1' }),
      ],
      { today },
    );

    expect(rows.map((r) => r.statement.closingBalance)).toEqual([50, 250, 0]);
    // A client with no entries at all still gets a line, not a gap.
    expect(rows[2]!.statement.lines).toHaveLength(0);
  });
});
