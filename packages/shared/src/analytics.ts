import type {
  CategoryBreakdown,
  LedgerTransaction,
  PeriodKind,
  PeriodRange,
  PeriodStats,
} from './types';

// All period math happens in UTC calendar fields so results don't shift
// depending on the server/browser's local timezone — a "month" is defined
// by its UTC date components, not by a timezone-relative instant.
function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfWeekUtc(d: Date): Date {
  const day = d.getUTCDay();
  // Monday-first week, matching how the source paper ledger's weeks read.
  const diff = (day === 0 ? -6 : 1) - day;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diff));
}

/**
 * Resolves a named period (week/month/quarter/year) relative to `reference`
 * into a concrete [start, end] ISO date range. For `custom`, `customStart`/
 * `customEnd` are passed through as-is (validated by the caller).
 */
export function getPeriodRange(
  kind: PeriodKind,
  reference: Date,
  custom?: { start: string; end: string },
): PeriodRange {
  if (kind === 'custom') {
    if (!custom) throw new Error('custom period requires start/end');
    return custom;
  }

  if (kind === 'week') {
    const start = startOfWeekUtc(reference);
    const end = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + 6),
    );
    return { start: toIsoDate(start), end: toIsoDate(end) };
  }

  const year = reference.getUTCFullYear();
  const month = reference.getUTCMonth();

  if (kind === 'month') {
    const start = new Date(Date.UTC(year, month, 1));
    const end = new Date(Date.UTC(year, month + 1, 0));
    return { start: toIsoDate(start), end: toIsoDate(end) };
  }

  if (kind === 'quarter') {
    const quarterStartMonth = Math.floor(month / 3) * 3;
    const start = new Date(Date.UTC(year, quarterStartMonth, 1));
    const end = new Date(Date.UTC(year, quarterStartMonth + 3, 0));
    return { start: toIsoDate(start), end: toIsoDate(end) };
  }

  // year
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year, 11, 31));
  return { start: toIsoDate(start), end: toIsoDate(end) };
}

function isWithinRange(occurredAt: string, range: PeriodRange): boolean {
  const date = occurredAt.slice(0, 10);
  return date >= range.start && date <= range.end;
}

/** A draft is not a posting. The dashboard's SQL has always excluded them
 * (`status <> 'draft'`); this path had not, so one unposted entry made the
 * client page and the dashboard disagree. */
function isPosted(t: LedgerTransaction): boolean {
  return t.status !== 'draft';
}

/**
 * Turnover for a period: total kirim/chiqim money, revenue, and a breakdown by
 * category+unit+kind so quantities (kg, dona, ...) are summed too — e.g.
 * "10 000 kg sochiq" and "5 000 dona xalat" for the same month.
 *
 * `net` is kirim minus chiqim on the receivable — how much the client's debt
 * *moved* over the period. It is not revenue, and it is not the debt itself;
 * see computeTotalDebt for that one.
 */
export function computePeriodStats(
  transactions: LedgerTransaction[],
  range: PeriodRange,
): PeriodStats {
  const inRange = transactions.filter((t) => isPosted(t) && isWithinRange(t.occurredAt, range));

  let totalKirim = 0;
  let totalChiqim = 0;
  let netRevenue = 0;
  const byCategoryMap = new Map<string, CategoryBreakdown>();

  for (const t of inRange) {
    const isKirim = t.debitAccountType === 'receivable';
    const isChiqim = t.creditAccountType === 'receivable';
    const amount = isKirim ? t.debitAmount : isChiqim ? t.creditAmount : 0;

    // Revenue lives on the sales account, not the receivable: a sale posts
    // Дебет Клиенты / Кредит Продажи. Credit less debit, so a reversal — which
    // debits it straight back off — nets itself out.
    if (t.creditAccountType === 'sales') netRevenue += t.creditAmount;
    if (t.debitAccountType === 'sales') netRevenue -= t.debitAmount;

    if (isKirim) totalKirim += amount;
    if (isChiqim) totalChiqim += amount;
    if (!isKirim && !isChiqim) continue;

    const kind = isKirim ? 'kirim' : 'chiqim';
    const categoryName = t.categoryName ?? '—';
    const key = `${categoryName}::${t.unit ?? ''}::${kind}`;
    const existing = byCategoryMap.get(key);

    if (existing) {
      existing.totalQuantity += t.quantity ?? 0;
      existing.totalAmount += amount;
      existing.transactionCount += 1;
    } else {
      byCategoryMap.set(key, {
        categoryName,
        unit: t.unit ?? null,
        kind,
        totalQuantity: t.quantity ?? 0,
        totalAmount: amount,
        transactionCount: 1,
      });
    }
  }

  return {
    range,
    totalKirim: Math.round(totalKirim * 100) / 100,
    totalChiqim: Math.round(totalChiqim * 100) / 100,
    net: Math.round((totalKirim - totalChiqim) * 100) / 100,
    netRevenue: Math.round(netRevenue * 100) / 100,
    transactionCount: inRange.length,
    byCategory: Array.from(byCategoryMap.values()).sort((a, b) => b.totalAmount - a.totalAmount),
  };
}

/**
 * Everything still owed, as of a date — the receivable position.
 *
 * Deliberately not range-scoped, which is the whole point of it. Debt is a
 * position and a position has no start date: bounding it below would give the
 * change over a window, which is exactly the figure that used to sit on the
 * dashboard under the wrong name.
 *
 * A client in credit nets off, so this is the net receivable — the same figure
 * as summing the per-client balances shown beside it.
 */
export function computeTotalDebt(transactions: LedgerTransaction[], asOf?: string): number {
  let debt = 0;

  for (const t of transactions) {
    if (!isPosted(t)) continue;
    if (asOf && t.occurredAt.slice(0, 10) > asOf) continue;

    if (t.debitAccountType === 'receivable') debt += t.debitAmount;
    if (t.creditAccountType === 'receivable') debt -= t.creditAmount;
  }

  return Math.round(debt * 100) / 100;
}

/**
 * Transactions with a due date ("srok") that has passed (overdue) or falls
 * within the next `withinDays` days — surfaced as an "upcoming debts"
 * widget, independent of the period filter.
 */
export function getDueSoonAndOverdue(
  transactions: LedgerTransaction[],
  today: Date,
  withinDays: number = 7,
): { overdue: LedgerTransaction[]; dueSoon: LedgerTransaction[] } {
  const todayIso = toIsoDate(today);
  const horizon = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + withinDays),
  );
  const horizonIso = toIsoDate(horizon);

  const withDueDate = transactions.filter((t) => t.dueDate);
  const overdue = withDueDate.filter((t) => t.dueDate! < todayIso);
  const dueSoon = withDueDate.filter((t) => t.dueDate! >= todayIso && t.dueDate! <= horizonIso);

  return { overdue, dueSoon };
}

export interface OverdueDebt {
  /** Sum of overdue "chiqim" amounts for this counterparty (not netted against the running balance). */
  overdueAmount: number;
  /** Earliest (oldest, most urgent) overdue due date. */
  overdueDate: string;
}

/**
 * Overdue "chiqim" total + earliest due date, grouped by counterparty —
 * mirrors LedgerTable's per-row overdue convention (isChiqim =
 * creditAccountType === 'receivable', overdue = dueDate < today), aggregated
 * per counterparty instead of netted against the running balance. Used both
 * for client-card badges and the analytics overdue-by-client breakdown.
 */
export function getOverdueByCounterparty(
  transactions: LedgerTransaction[],
  today: Date,
): Record<string, OverdueDebt> {
  const todayIso = toIsoDate(today);
  const result: Record<string, OverdueDebt> = {};

  for (const t of transactions) {
    if (t.creditAccountType !== 'receivable' || !t.dueDate || t.dueDate >= todayIso) continue;

    const existing = result[t.counterpartyId];
    result[t.counterpartyId] = {
      overdueAmount: (existing?.overdueAmount ?? 0) + t.creditAmount,
      overdueDate: existing
        ? t.dueDate < existing.overdueDate
          ? t.dueDate
          : existing.overdueDate
        : t.dueDate,
    };
  }

  return result;
}
