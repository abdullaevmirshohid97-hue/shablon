import {
  computePeriodStats,
  getDueSoonAndOverdue,
  getOverdueByCounterparty,
  type LedgerTransaction,
  type PeriodRange,
} from '@mubosher/shared';
import type { OrgReport } from '@mubosher/api-client';

/**
 * What the analytics card renders. Deliberately narrow: the card is
 * presentation only, so the dashboard can feed it aggregates computed in
 * Postgres while a single client's ledger — where the rows are already in
 * memory — feeds it the same shape computed locally.
 */
export interface AnalyticsData {
  totalKirim: number;
  totalChiqim: number;
  net: number;
  transactionCount: number;
  byCategory: {
    categoryName: string;
    unit: string | null;
    kind: 'kirim' | 'chiqim';
    totalQuantity: number;
    totalAmount: number;
  }[];
  overdue: { id: string; name: string; overdueAmount: number; overdueDate: string }[];
  dueSoon: { id: string; label: string; dueDate: string }[];
}

/** Dashboard path: straight from the RPCs, nothing recomputed. */
export function analyticsFromReport(report: OrgReport): AnalyticsData {
  return {
    totalKirim: report.totals.totalKirim,
    totalChiqim: report.totals.totalChiqim,
    net: report.totals.net,
    transactionCount: report.byCategory.reduce((n, c) => n + c.entryCount, 0),
    byCategory: report.byCategory,
    overdue: report.overdue.map((r) => ({
      id: r.counterpartyId,
      name: r.name,
      overdueAmount: r.overdueAmount,
      overdueDate: r.overdueDate,
    })),
    dueSoon: report.dueSoon.map((r) => ({
      id: r.transactionId,
      label: r.description ?? r.counterpartyName,
      dueDate: r.dueDate,
    })),
  };
}

/**
 * Single-client path. Aggregating one client's ledger in the browser is
 * cheap — the rows are already loaded to draw the journal — and it keeps the
 * figures consistent with the running balance shown beside them.
 */
export function analyticsFromTransactions(
  transactions: LedgerTransaction[],
  counterparties: { id: string; name: string }[],
  range: PeriodRange,
  today: Date,
): AnalyticsData {
  const stats = computePeriodStats(transactions, range);
  const { dueSoon } = getDueSoonAndOverdue(transactions, today, 7);
  const nameById = new Map(counterparties.map((c) => [c.id, c.name]));

  return {
    totalKirim: stats.totalKirim,
    totalChiqim: stats.totalChiqim,
    net: stats.net,
    transactionCount: stats.transactionCount,
    byCategory: stats.byCategory,
    overdue: Object.entries(getOverdueByCounterparty(transactions, today))
      .map(([id, debt]) => ({ id, name: nameById.get(id) ?? '—', ...debt }))
      .sort((a, b) => b.overdueAmount - a.overdueAmount),
    dueSoon: dueSoon.map((tx) => ({
      id: tx.id,
      label: tx.description ?? '',
      dueDate: tx.dueDate!,
    })),
  };
}
