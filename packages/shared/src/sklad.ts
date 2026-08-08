import type { SkladLineProgress, SkladReceiveRow, SkladStageCell } from './types';

/**
 * The arithmetic behind the warehouse screens, pulled out of the components
 * that used to hold it inline.
 *
 * These are the parts that can be wrong in a way nobody notices: a total that
 * silently skips a row, a remainder that goes negative, an allocation that
 * lets a despatch exceed what is owed. Rendering can be checked by looking at
 * it; this cannot, so it lives here where a test can reach it.
 */

/** A grid row nobody has typed into yet. Blank rows exist by the dozen — the
 * receiving page keeps spare ones below the cursor — and none of them is an
 * error, so every count and total has to agree on what "blank" means. */
export function isBlankReceiveRow(row: SkladReceiveRow): boolean {
  return Object.values(row).every((value) => !value || !String(value).trim());
}

export interface ReceiveTotals {
  /** Rows that will actually be sent to the database. */
  rowCount: number;
  nettoKg: number;
  dona: number;
  amount: number;
}

/**
 * The footer of the receiving grid.
 *
 * Blank rows are skipped, and so is anything that will not parse: a cell
 * holding "12kg" contributes nothing rather than NaN, which would otherwise
 * poison the whole column and leave the storekeeper with no total at all.
 */
export function summariseReceiveRows(rows: SkladReceiveRow[]): ReceiveTotals {
  const filled = rows.filter((row) => !isBlankReceiveRow(row));

  return filled.reduce<ReceiveTotals>(
    (totals, row) => ({
      rowCount: totals.rowCount,
      nettoKg: totals.nettoKg + toNumber(row.netto),
      dona: totals.dona + toNumber(row.dona),
      amount: totals.amount + toNumber(row.totalAmount),
    }),
    { rowCount: filled.length, nettoKg: 0, dona: 0, amount: 0 },
  );
}

function toNumber(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export interface OrderTotals {
  planned: number;
  ready: number;
  shipped: number;
  remaining: number;
  defect: number;
}

/** Column totals for the order grid, across every row of the order. */
export function summariseOrderProgress(lines: SkladLineProgress[]): OrderTotals {
  return lines.reduce<OrderTotals>(
    (totals, line) => ({
      planned: totals.planned + (line.plannedDona ?? 0),
      ready: totals.ready + line.readyDona,
      shipped: totals.shipped + line.shippedDona,
      remaining: totals.remaining + line.remainingDona,
      defect: totals.defect + line.defectDona,
    }),
    { planned: 0, ready: 0, shipped: 0, remaining: 0, defect: 0 },
  );
}

/** Key for the (row, stage) grid lookup. One helper so the writer and the
 * reader of the map cannot drift apart. */
export function stageCellKey(lineId: string, stageId: string): string {
  return `${lineId}:${stageId}`;
}

export function indexStageCells(cells: SkladStageCell[]): Map<string, SkladStageCell> {
  return new Map(cells.map((cell) => [stageCellKey(cell.lineId, cell.stageId), cell]));
}

/** What one shop has put out across the whole order — the stage column's foot. */
export function sumStageOutput(cells: SkladStageCell[], stageId: string): number {
  return cells
    .filter((cell) => cell.stageId === stageId)
    .reduce((total, cell) => total + (cell.qtyOut ?? 0), 0);
}

/**
 * What may be despatched for one row right now.
 *
 * Clamped to the outstanding balance in both directions: a negative is a
 * mis-key, and an over-despatch drives the remainder below zero, where every
 * total downstream quietly stops meaning anything. Blank stays blank — the
 * storekeeper clearing a cell should not see a 0 appear under their cursor.
 */
export function clampShipmentQty(input: string, remaining: number): string {
  if (input.trim() === '') return '';
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) return '';
  return String(Math.min(Math.max(parsed, 0), Math.max(remaining, 0)));
}

/** Progress as a whole percent, never above 100 and never dividing by zero. */
export function completionPercent(value: number, total: number): number {
  if (!(total > 0)) return 0;
  return Math.min(100, Math.max(0, Math.round((value / total) * 100)));
}
