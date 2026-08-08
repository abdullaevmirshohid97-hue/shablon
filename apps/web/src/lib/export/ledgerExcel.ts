import * as XLSX from 'xlsx-js-style';
import {
  computeRunningBalance,
  dictionaries,
  translate,
  type LedgerTransaction,
  type Locale,
  type PeriodRange,
} from '@mubosher/shared';
import {
  round2,
  safeSheetName,
  sanitizeFileName,
  setStyle,
  subtitleStyle,
  summaryLabelStyle,
  summaryValueStyle,
  tableCellStyle,
  tableHeaderStyle,
  titleStyle,
} from './styles';

export interface LedgerSheetResult {
  sheet: XLSX.WorkSheet;
  totalKirim: number;
  totalChiqim: number;
  /** Signed: negative means the org owes the counterparty (the "К" side). */
  closingBalance: number;
  overdueAmount: number;
  rowCount: number;
}

function formatRange(range: PeriodRange, dateLocale: string): string {
  return `${new Date(range.start).toLocaleDateString(dateLocale)} — ${new Date(
    range.end,
  ).toLocaleDateString(dateLocale)}`;
}

/**
 * Builds one counterparty's journal sheet.
 *
 * `allTransactions` must be the counterparty's *full* chronological history
 * even when a period is requested: the running balance is accumulated over
 * everything, then the sheet shows only the rows inside `range` with the
 * carried-in figure printed as an opening balance. Slicing first would restart
 * the balance from zero and misstate every row.
 */
export function buildLedgerSheet(
  counterpartyName: string,
  allTransactions: LedgerTransaction[],
  locale: Locale,
  range?: PeriodRange | null,
): LedgerSheetResult {
  const dict = dictionaries[locale];
  const tr = (path: string) => translate(dict, path);
  const dateLocale = locale === 'ru' ? 'ru-RU' : 'uz-UZ';
  const todayIso = new Date().toISOString().slice(0, 10);

  // Parallel-indexed to `allTransactions` (both chronological) — credit side is
  // signed negative so the spreadsheet cell reads as "we owe" out of the box.
  const balances = computeRunningBalance(allTransactions);
  const signed = (i: number) => {
    const b = balances[i];
    if (!b) return 0;
    return b.side === 'credit' ? -b.balance : b.balance;
  };

  const inRange = (t: LedgerTransaction) => {
    if (!range) return true;
    const date = t.occurredAt.slice(0, 10);
    return date >= range.start && date <= range.end;
  };

  // Counted rather than taken from the first in-range row, so a client with
  // history before the period but no activity *inside* it still reports the
  // balance it carried in instead of a misleading zero.
  const beforeCount = range
    ? allTransactions.filter((t) => t.occurredAt.slice(0, 10) < range.start).length
    : 0;
  const openingBalance = beforeCount > 0 ? signed(beforeCount - 1) : 0;

  let totalKirim = 0;
  let totalChiqim = 0;
  let overdueAmount = 0;
  let overdueDate: string | null = null;
  let closingBalance = openingBalance;

  const rows: (string | number)[][] = [];

  allTransactions.forEach((t, i) => {
    if (!inRange(t)) return;

    const isKirim = t.debitAccountType === 'receivable';
    const isChiqim = t.creditAccountType === 'receivable';
    if (isKirim) totalKirim += t.debitAmount;
    if (isChiqim) totalChiqim += t.creditAmount;
    if (isChiqim && t.dueDate && t.dueDate < todayIso) {
      overdueAmount += t.creditAmount;
      if (!overdueDate || t.dueDate < overdueDate) overdueDate = t.dueDate;
    }
    closingBalance = signed(i);

    rows.push([
      new Date(t.occurredAt).toLocaleDateString(dateLocale),
      t.documentNo ?? '',
      t.description ?? '',
      t.quantityKg ?? (t.unit === 'kg' ? t.quantity : '') ?? '',
      t.quantityDona ?? (t.unit === 'dona' ? t.quantity : '') ?? '',
      isChiqim ? t.creditAmount : '',
      isKirim ? t.debitAmount : '',
      isChiqim && t.dueDate ? new Date(t.dueDate).toLocaleDateString(dateLocale) : '',
      signed(i),
    ]);
  });

  // The journal shows newest first on screen; the export mirrors that.
  const orderedRows = [...rows].reverse();

  const headerRow = [
    tr('ledger.date'),
    tr('ledger.documentNo'),
    tr('ledger.process'),
    tr('ledger.kg'),
    tr('ledger.dona'),
    tr('ledger.chiqimSumma'),
    tr('ledger.kirimSumma'),
    tr('ledger.chiqimMuddati'),
    tr('ledger.balance'),
  ];
  const colCount = headerRow.length;

  const summaryRows: (string | number)[][] = [];
  if (range) {
    summaryRows.push([tr('export.period'), formatRange(range, dateLocale)]);
    summaryRows.push([tr('export.openingBalance'), round2(openingBalance)]);
  }
  summaryRows.push([tr('analytics.totalKirim'), round2(totalKirim)]);
  summaryRows.push([tr('analytics.totalChiqim'), round2(totalChiqim)]);
  summaryRows.push([tr('analytics.debtChange'), round2(totalKirim - totalChiqim)]);
  summaryRows.push([tr('export.closingBalance'), round2(closingBalance)]);
  if (overdueAmount > 0) {
    summaryRows.push([
      tr('analytics.overdueTotal'),
      round2(overdueAmount),
      overdueDate ? new Date(overdueDate).toLocaleDateString(dateLocale) : '',
    ]);
  }

  const titleRowIndex = 0;
  const generatedRowIndex = 1;
  const summaryStartRow = 3;
  const headerRowIndex = summaryStartRow + summaryRows.length + 1;
  const dataStartRow = headerRowIndex + 1;

  const aoa: (string | number)[][] = [
    [counterpartyName],
    [`${tr('export.generatedAt')}: ${new Date().toLocaleString(dateLocale)}`],
    [],
    ...summaryRows,
    [],
    headerRow,
    ...orderedRows,
  ];

  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  sheet['!cols'] = headerRow.map((_, i) => ({ wch: i === 2 ? 26 : 16 }));
  sheet['!merges'] = [
    { s: { r: titleRowIndex, c: 0 }, e: { r: titleRowIndex, c: colCount - 1 } },
    { s: { r: generatedRowIndex, c: 0 }, e: { r: generatedRowIndex, c: colCount - 1 } },
  ];

  setStyle(sheet, titleRowIndex, 0, titleStyle);
  setStyle(sheet, generatedRowIndex, 0, subtitleStyle);

  summaryRows.forEach((row, i) => {
    const r = summaryStartRow + i;
    setStyle(sheet, r, 0, summaryLabelStyle);
    row.slice(1).forEach((_, ci) => setStyle(sheet, r, ci + 1, summaryValueStyle));
  });

  headerRow.forEach((_, c) => setStyle(sheet, headerRowIndex, c, tableHeaderStyle));
  orderedRows.forEach((row, ri) => {
    row.forEach((_, c) => setStyle(sheet, dataStartRow + ri, c, tableCellStyle));
  });

  return {
    sheet,
    totalKirim: round2(totalKirim),
    totalChiqim: round2(totalChiqim),
    closingBalance: round2(closingBalance),
    overdueAmount: round2(overdueAmount),
    rowCount: rows.length,
  };
}

export function exportLedgerToExcel(
  counterpartyName: string,
  transactions: LedgerTransaction[],
  locale: Locale,
  range?: PeriodRange | null,
): void {
  const { sheet } = buildLedgerSheet(counterpartyName, transactions, locale, range);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, safeSheetName('Jurnal', new Set()));

  const suffix = range ? `_${range.start}_${range.end}` : '';
  XLSX.writeFile(workbook, `${sanitizeFileName(counterpartyName)}_jurnal${suffix}.xlsx`);
}
