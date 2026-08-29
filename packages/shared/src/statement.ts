import type { LedgerTransaction, PeriodRange, TransactionStatus } from './types';

/**
 * One counterparty's account statement — the bank-style "ko'chirma" that the
 * ledger screen, the printed page and the Excel file are all three drawn from.
 *
 * It exists because they used to be drawn from three different sums. The
 * dashboard aggregates in Postgres (0019/0031/0032) over `base_*` amounts with
 * drafts excluded; the Excel builder re-derived its own totals in the browser
 * over raw amounts with drafts included, and carried a copy of the overdue
 * formula that 0031 had already replaced for being wrong. Two figures for the
 * same client on the same screen is not a formatting problem, so the
 * arithmetic now lives here once and everything renders it.
 *
 * Every money figure is in the org's base currency, for the same reason the
 * SQL is: adding a raw USD amount to a raw UZS one produces a number that
 * means nothing.
 */

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Days between two ISO dates (`to` − `from`), positive when `to` is later. */
function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/**
 * A draft is not a posting. The reporting SQL has always excluded them
 * (`status <> 'draft'`); the browser-side ledger had not, so one unposted row
 * made the client page and the dashboard disagree.
 */
export function isPostedEntry(t: LedgerTransaction): boolean {
  return t.status !== 'draft';
}

/**
 * The receivable legs of an entry, in base currency.
 *
 * `base_*` is written by a trigger on insert (0017) and is null only on rows
 * that predate it — those were all base currency at rate 1, so falling back to
 * the raw amount is exactly right rather than a guess.
 */
export function baseLegs(t: LedgerTransaction): { debit: number; credit: number } {
  return {
    debit: t.debitAccountType === 'receivable' ? (t.baseDebitAmount ?? t.debitAmount) : 0,
    credit: t.creditAccountType === 'receivable' ? (t.baseCreditAmount ?? t.creditAmount) : 0,
  };
}

/** Signed movement on the receivable: positive means the client owes more. */
export function receivableDelta(t: LedgerTransaction): number {
  const { debit, credit } = baseLegs(t);
  return debit - credit;
}

export interface StatementLine {
  transactionId: string;
  occurredAt: string;
  documentNo: string | null;
  description: string | null;
  categoryName: string | null;
  quantityKg: number | null;
  quantityDona: number | null;
  /** The currency the entry was actually made in, and the rate it converted at. */
  currency: string;
  exchangeRate: number;
  /** As entered, in `currency`. */
  debit: number;
  credit: number;
  /** The same two in base currency — what every total below is summed from. */
  baseDebit: number;
  baseCredit: number;
  dueDate: string | null;
  /** How many days past its deadline, at the statement date. Null when it has none or is not yet due. */
  daysOverdue: number | null;
  status: TransactionStatus;
  /** False for drafts: shown, never counted. */
  counted: boolean;
  /** Signed receivable after this line. Positive: they owe us. */
  balanceAfter: number;
}

export interface AgingBucket {
  /** Inclusive lower bound in days past due. */
  fromDays: number;
  /** Inclusive upper bound, or null for the open-ended oldest bucket. */
  toDays: number | null;
  amount: number;
}

export interface CounterpartyStatement {
  /** Statement date: every "as of" figure is taken here. The period end, or today if the period has not closed yet. */
  asOf: string;
  range: PeriodRange | null;
  /** Signed receivable carried into the period. */
  openingBalance: number;
  /** Period turnover on the receivable, base currency. */
  debitTurnover: number;
  creditTurnover: number;
  /** debitTurnover − creditTurnover: how far the debt moved over the period. */
  netChange: number;
  /** Signed receivable at the end of the period. Positive: they owe us. */
  closingBalance: number;
  /** What they owe at `asOf` — floored at zero, matching `total_debt` in 0032. */
  totalDebt: number;
  /** A credit balance as a positive number: money of theirs we are holding. */
  advance: number;
  /** Past due at `asOf`, on the 0032 rule. */
  overdueAmount: number;
  /** Since when they have been late — the oldest deadline already passed. */
  overdueDate: string | null;
  /** The nearest deadline still ahead. */
  nextDueDate: string | null;
  /** `overdueAmount` split by how long it has been outstanding; the buckets sum back to it. */
  aging: AgingBucket[];
  /** Debt whose deadline has not arrived, or which carries none. */
  notYetDue: number;
  /** The lines inside `range`, oldest first. */
  lines: StatementLine[];
  /** Distinct currencies among the lines. More than one means the original-currency columns must not be summed. */
  currencies: string[];
  /** Counts over the whole history, not just the listed period. */
  draftCount: number;
  reversedCount: number;
  lastEntryAt: string | null;
}

/** Days past due at which each aging bucket starts. */
const AGING_EDGES = [1, 31, 61, 91];

export interface StatementOptions {
  /** Restricts which lines are listed. Balances still accumulate over everything before it. */
  range?: PeriodRange | null;
  /** Defaults to today. */
  today?: Date;
}

/**
 * Builds the statement from a counterparty's *full* chronological history.
 *
 * The full history is required even when a period is requested: the running
 * balance accumulates over everything and the period only decides which lines
 * are listed, with the carried-in figure printed as an opening balance.
 * Slicing first would restart the balance at zero and misstate every row.
 */
export function buildStatement(
  transactions: LedgerTransaction[],
  options: StatementOptions = {},
): CounterpartyStatement {
  const { range = null } = options;
  const today = isoDate(options.today ?? new Date());
  // A statement is dated. For a period already closed that date is its end;
  // for one still running — "this month", on the 12th — it is today, because
  // aging a debt against a date that has not arrived would report every
  // deadline in the period as already missed.
  const asOf = range && range.end < today ? range.end : today;

  let running = 0;
  let openingBalance = 0;
  let debitTurnover = 0;
  let creditTurnover = 0;
  let draftCount = 0;
  let reversedCount = 0;
  let lastEntryAt: string | null = null;
  const currencies = new Set<string>();
  const lines: StatementLine[] = [];

  for (const t of transactions) {
    const date = t.occurredAt.slice(0, 10);
    const counted = isPostedEntry(t);

    if (!counted) draftCount += 1;
    if (t.status === 'reversed' || t.status === 'reversal') reversedCount += 1;
    if (!lastEntryAt || t.occurredAt > lastEntryAt) lastEntryAt = t.occurredAt;

    // Later than the period: not part of this statement at all. Including it
    // would print a closing balance the listed rows cannot add up to.
    if (range && date > range.end) continue;

    const { debit, credit } = counted ? baseLegs(t) : { debit: 0, credit: 0 };
    running += debit - credit;

    // Earlier than the period: carried in as one figure rather than listed.
    if (range && date < range.start) {
      openingBalance = running;
      continue;
    }

    if (counted) {
      debitTurnover += debit;
      creditTurnover += credit;
    }
    currencies.add(t.currency);

    const isDebitLeg = t.debitAccountType === 'receivable';
    const isCreditLeg = t.creditAccountType === 'receivable';

    lines.push({
      transactionId: t.id,
      occurredAt: t.occurredAt,
      documentNo: t.documentNo ?? null,
      description: t.description ?? null,
      categoryName: t.categoryName ?? null,
      quantityKg: t.quantityKg ?? (t.unit === 'kg' ? (t.quantity ?? null) : null),
      quantityDona: t.quantityDona ?? (t.unit === 'dona' ? (t.quantity ?? null) : null),
      currency: t.currency,
      exchangeRate: t.exchangeRate ?? 1,
      debit: isDebitLeg ? t.debitAmount : 0,
      credit: isCreditLeg ? t.creditAmount : 0,
      baseDebit: round2(debit),
      baseCredit: round2(credit),
      dueDate: t.dueDate ?? null,
      daysOverdue: t.dueDate && t.dueDate < asOf ? daysBetween(t.dueDate, asOf) : null,
      status: t.status,
      counted,
      balanceAfter: round2(running),
    });
  }

  const closingBalance = round2(running);

  const aged = computeOverdue(transactions, asOf);

  return {
    asOf,
    range,
    openingBalance: round2(openingBalance),
    debitTurnover: round2(debitTurnover),
    creditTurnover: round2(creditTurnover),
    netChange: round2(debitTurnover - creditTurnover),
    closingBalance,
    totalDebt: aged.totalDebt,
    advance: round2(Math.max(-aged.balanceAsOf, 0)),
    overdueAmount: aged.overdueAmount,
    overdueDate: aged.overdueDate,
    nextDueDate: aged.nextDueDate,
    aging: aged.aging,
    notYetDue: round2(Math.max(aged.totalDebt - aged.overdueAmount, 0)),
    lines,
    currencies: [...currencies].sort(),
    draftCount,
    reversedCount,
    lastEntryAt,
  };
}

/**
 * How old the debt is.
 *
 * The rule is the one 0032 settled on, and it is deliberately not "sum the
 * rows that are past their date": only the payment leg carries a deadline, so
 * summing those rows measures money the client has already handed over — the
 * more they paid, the larger their "overdue" read. What is past due is instead
 * what was outstanding when a deadline passed, less everything paid since,
 * capped at the current balance, because nobody can owe more overdue than they
 * owe altogether. Oldest debt settles first, which is how an aged receivable is
 * expected to behave: a payment clears the oldest bucket, a new sale lands in
 * the youngest.
 *
 * Every bucket edge is evaluated by that same rule, which is what makes the
 * ladder monotone — each bucket is the difference between two of these figures.
 */
export interface OverdueBreakdown {
  /** Signed receivable at `asOf`. */
  balanceAsOf: number;
  /** The same, floored at zero. */
  totalDebt: number;
  overdueAmount: number;
  overdueDate: string | null;
  nextDueDate: string | null;
  aging: AgingBucket[];
}

export function computeOverdue(transactions: LedgerTransaction[], asOf: string): OverdueBreakdown {
  const posted = transactions.filter((t) => isPostedEntry(t) && t.occurredAt.slice(0, 10) <= asOf);

  let balanceAsOf = 0;
  for (const t of posted) balanceAsOf += receivableDelta(t);
  balanceAsOf = round2(balanceAsOf);
  const totalDebt = Math.max(balanceAsOf, 0);

  const dueDates = posted
    .map((t) => t.dueDate)
    .filter((d): d is string => Boolean(d))
    .sort();
  const pastDue = dueDates.filter((d) => d < asOf);
  const overdueDate = pastDue[0] ?? null;
  const nextDueDate = dueDates.find((d) => d >= asOf) ?? null;

  /** What was still outstanding on `day`, less everything paid after it. */
  const outstandingSince = (day: string): number => {
    let balanceThen = 0;
    let paidAfter = 0;
    for (const t of posted) {
      const { debit, credit } = baseLegs(t);
      if (t.occurredAt.slice(0, 10) <= day) balanceThen += debit - credit;
      // A reversal cancels an entry; it is not money anyone handed over. Left
      // in, correcting a mistyped sale would quietly clear the client's oldest
      // debt as though they had paid it.
      else if (t.status !== 'reversal') paidAfter += credit;
    }
    return round2(Math.min(Math.max(balanceThen - paidAfter, 0), totalDebt));
  };

  /** The part of the debt outstanding for at least `days` days. */
  const agedAtLeast = (days: number): number => {
    // The newest deadline already this old bounds the whole set: these figures
    // are non-decreasing in the date, so that one is the largest of them.
    const edge = pastDue.filter((d) => daysBetween(d, asOf) >= days).pop();
    return edge ? outstandingSince(edge) : 0;
  };

  const totals = AGING_EDGES.map(agedAtLeast);
  const aging: AgingBucket[] = AGING_EDGES.map((fromDays, i) => ({
    fromDays,
    toDays: i + 1 < AGING_EDGES.length ? AGING_EDGES[i + 1]! - 1 : null,
    amount: round2(Math.max(totals[i]! - (totals[i + 1] ?? 0), 0)),
  }));

  return {
    balanceAsOf,
    totalDebt: round2(totalDebt),
    overdueAmount: totals[0] ?? 0,
    overdueDate,
    nextDueDate,
    aging,
  };
}

/** One client's line in a multi-client report, with the statement it was derived from. */
export interface StatementSummaryRow<T extends { id: string; name: string }> {
  counterparty: T;
  statement: CounterpartyStatement;
}

/**
 * The same builder, once per client — so a summary row can never drift from
 * the detail sheet printed next to it.
 */
export function buildStatements<T extends { id: string; name: string }>(
  counterparties: T[],
  transactions: LedgerTransaction[],
  options: StatementOptions = {},
): StatementSummaryRow<T>[] {
  const byCounterparty = new Map<string, LedgerTransaction[]>();
  for (const t of transactions) {
    const bucket = byCounterparty.get(t.counterpartyId);
    if (bucket) bucket.push(t);
    else byCounterparty.set(t.counterpartyId, [t]);
  }

  return counterparties.map((counterparty) => ({
    counterparty,
    statement: buildStatement(byCounterparty.get(counterparty.id) ?? [], options),
  }));
}
