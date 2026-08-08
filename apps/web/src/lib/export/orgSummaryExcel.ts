import * as XLSX from 'xlsx-js-style';
import {
  dictionaries,
  translate,
  type LedgerTransaction,
  type Locale,
  type PeriodRange,
} from '@mubosher/shared';
import { buildLedgerSheet } from './ledgerExcel';
import {
  round2,
  safeSheetName,
  sanitizeFileName,
  setStyle,
  subtitleStyle,
  tableCellStyle,
  tableHeaderStyle,
  titleStyle,
  totalsRowStyle,
} from './styles';

/**
 * A workbook with one tab per client stops being openable somewhere in the
 * low hundreds — beyond this many the detail tabs are dropped and the summary
 * says so, rather than producing a file Excel refuses to load.
 */
const MAX_DETAIL_SHEETS = 40;

export interface SummaryCounterparty {
  id: string;
  name: string;
}

/**
 * The org-wide (or single-module) report a manager hands over: a "Xulosa"
 * tab with one line per client — turnover, closing balance and overdue debt
 * for the period — followed by the full journal of every client that had
 * activity, each on its own tab.
 */
export function exportOrgSummaryToExcel(
  title: string,
  counterparties: SummaryCounterparty[],
  transactions: LedgerTransaction[],
  locale: Locale,
  range?: PeriodRange | null,
): void {
  const dict = dictionaries[locale];
  const tr = (path: string) => translate(dict, path);
  const dateLocale = locale === 'ru' ? 'ru-RU' : 'uz-UZ';

  const byCounterparty = new Map<string, LedgerTransaction[]>();
  for (const t of transactions) {
    const bucket = byCounterparty.get(t.counterpartyId);
    if (bucket) bucket.push(t);
    else byCounterparty.set(t.counterpartyId, [t]);
  }

  // One pass: each client's sheet and its totals come from the same builder
  // the per-client export uses, so the summary line can never drift from the
  // detail tab next to it.
  const built = counterparties
    .map((c) => ({
      counterparty: c,
      result: buildLedgerSheet(c.name, byCounterparty.get(c.id) ?? [], locale, range),
    }))
    .sort((a, b) => b.result.closingBalance - a.result.closingBalance);

  const withActivity = built.filter((b) => b.result.rowCount > 0);
  const detailsOmitted = withActivity.length > MAX_DETAIL_SHEETS;

  // ---------------------------------------------------------------
  // Summary sheet
  // ---------------------------------------------------------------
  const headerRow = [
    tr('export.client'),
    tr('analytics.totalKirim'),
    tr('analytics.totalChiqim'),
    tr('analytics.debtChange'),
    tr('export.closingBalance'),
    tr('analytics.overdueTotal'),
    tr('export.entryCount'),
  ];

  const dataRows = built.map((b) => [
    b.counterparty.name,
    b.result.totalKirim,
    b.result.totalChiqim,
    round2(b.result.totalKirim - b.result.totalChiqim),
    b.result.closingBalance,
    b.result.overdueAmount,
    b.result.rowCount,
  ]);

  const totals = built.reduce(
    (acc, b) => ({
      kirim: acc.kirim + b.result.totalKirim,
      chiqim: acc.chiqim + b.result.totalChiqim,
      balance: acc.balance + b.result.closingBalance,
      overdue: acc.overdue + b.result.overdueAmount,
      count: acc.count + b.result.rowCount,
    }),
    { kirim: 0, chiqim: 0, balance: 0, overdue: 0, count: 0 },
  );

  const totalsRow: (string | number)[] = [
    tr('export.total'),
    round2(totals.kirim),
    round2(totals.chiqim),
    round2(totals.kirim - totals.chiqim),
    round2(totals.balance),
    round2(totals.overdue),
    totals.count,
  ];

  const subtitleParts = [
    `${tr('export.generatedAt')}: ${new Date().toLocaleString(dateLocale)}`,
    range
      ? `${tr('export.period')}: ${new Date(range.start).toLocaleDateString(
          dateLocale,
        )} — ${new Date(range.end).toLocaleDateString(dateLocale)}`
      : tr('export.periodAll'),
    `${tr('export.clientCount')}: ${built.length}`,
  ];
  if (detailsOmitted) subtitleParts.push(tr('export.detailsOmitted'));

  const titleRowIndex = 0;
  const subtitleRowIndex = 1;
  const headerRowIndex = 3;
  const dataStartRow = headerRowIndex + 1;
  const totalsRowIndex = dataStartRow + dataRows.length;

  const summarySheet = XLSX.utils.aoa_to_sheet([
    [title],
    [subtitleParts.join('   •   ')],
    [],
    headerRow,
    ...dataRows,
    totalsRow,
  ]);

  summarySheet['!cols'] = headerRow.map((_, i) => ({ wch: i === 0 ? 30 : 16 }));
  summarySheet['!merges'] = [
    { s: { r: titleRowIndex, c: 0 }, e: { r: titleRowIndex, c: headerRow.length - 1 } },
    { s: { r: subtitleRowIndex, c: 0 }, e: { r: subtitleRowIndex, c: headerRow.length - 1 } },
  ];

  setStyle(summarySheet, titleRowIndex, 0, titleStyle);
  setStyle(summarySheet, subtitleRowIndex, 0, subtitleStyle);
  headerRow.forEach((_, c) => setStyle(summarySheet, headerRowIndex, c, tableHeaderStyle));
  dataRows.forEach((row, ri) => {
    row.forEach((_, c) => setStyle(summarySheet, dataStartRow + ri, c, tableCellStyle));
  });
  totalsRow.forEach((_, c) => setStyle(summarySheet, totalsRowIndex, c, totalsRowStyle));

  // ---------------------------------------------------------------
  // Workbook
  // ---------------------------------------------------------------
  const workbook = XLSX.utils.book_new();
  const usedNames = new Set<string>();

  XLSX.utils.book_append_sheet(
    workbook,
    summarySheet,
    safeSheetName(tr('export.summarySheet'), usedNames),
  );

  if (!detailsOmitted) {
    for (const { counterparty, result } of withActivity) {
      XLSX.utils.book_append_sheet(
        workbook,
        result.sheet,
        safeSheetName(counterparty.name, usedNames),
      );
    }
  }

  const suffix = range ? `_${range.start}_${range.end}` : '';
  XLSX.writeFile(workbook, `${sanitizeFileName(title)}_hisobot${suffix}.xlsx`);
}
