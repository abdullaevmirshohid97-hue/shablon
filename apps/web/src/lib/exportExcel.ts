import * as XLSX from 'xlsx-js-style';
import {
  computeRunningBalance,
  dictionaries,
  translate,
  type LedgerTransaction,
  type Locale,
} from '@mubosher/shared';

const BORDER_COLOR = { rgb: 'CBD5E1' }; // slate-300
const thinBorder = { style: 'thin', color: BORDER_COLOR };
const fullBorder = {
  top: thinBorder,
  bottom: thinBorder,
  left: thinBorder,
  right: thinBorder,
};

const titleStyle = { font: { bold: true, sz: 14 } };
const summaryLabelStyle = { font: { bold: true }, border: fullBorder };
const summaryValueStyle = {
  font: { bold: true },
  border: fullBorder,
  alignment: { horizontal: 'right' },
};
const tableHeaderStyle = {
  font: { bold: true, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: '475569' } }, // slate-600
  border: fullBorder,
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
};
const tableCellStyle = { border: fullBorder };

export function exportLedgerToExcel(
  counterpartyName: string,
  transactions: LedgerTransaction[],
  locale: Locale,
) {
  const dict = dictionaries[locale];
  const tr = (path: string) => translate(dict, path);
  const dateLocale = locale === 'ru' ? 'ru-RU' : 'uz-UZ';
  const todayIso = new Date().toISOString().slice(0, 10);

  // Parallel-indexed to `transactions` (both chronological) — credit side is
  // signed negative so the spreadsheet cell reads as "we owe" out of the box.
  const balances = computeRunningBalance(transactions);

  let totalKirim = 0;
  let totalChiqim = 0;
  let overdueAmount = 0;
  let overdueDate: string | null = null;

  const rows = transactions.map((t, i) => {
    const isKirim = t.debitAccountType === 'receivable';
    const isChiqim = t.creditAccountType === 'receivable';
    if (isKirim) totalKirim += t.debitAmount;
    if (isChiqim) totalChiqim += t.creditAmount;
    if (isChiqim && t.dueDate && t.dueDate < todayIso) {
      overdueAmount += t.creditAmount;
      if (!overdueDate || t.dueDate < overdueDate) overdueDate = t.dueDate;
    }

    const bal = balances[i];
    return [
      new Date(t.occurredAt).toLocaleDateString(dateLocale),
      t.documentNo ?? '',
      t.description ?? '',
      t.quantityKg ?? (t.unit === 'kg' ? t.quantity : '') ?? '',
      t.quantityDona ?? (t.unit === 'dona' ? t.quantity : '') ?? '',
      isChiqim ? t.creditAmount : '',
      isKirim ? t.debitAmount : '',
      isChiqim && t.dueDate ? new Date(t.dueDate).toLocaleDateString(dateLocale) : '',
      bal ? (bal.side === 'credit' ? -bal.balance : bal.balance) : '',
    ];
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

  const round2 = (n: number) => Math.round(n * 100) / 100;
  const summaryRows: (string | number)[][] = [
    [tr('analytics.totalKirim'), round2(totalKirim)],
    [tr('analytics.totalChiqim'), round2(totalChiqim)],
    [tr('analytics.net'), round2(totalKirim - totalChiqim)],
  ];
  if (overdueAmount > 0) {
    summaryRows.push([
      tr('analytics.overdueTotal'),
      round2(overdueAmount),
      overdueDate ? new Date(overdueDate).toLocaleDateString(dateLocale) : '',
    ]);
  }

  const titleRowIndex = 0;
  const summaryStartRow = 2;
  const headerRowIndex = summaryStartRow + summaryRows.length + 1;
  const dataStartRow = headerRowIndex + 1;

  const aoa: (string | number)[][] = [
    [counterpartyName],
    [],
    ...summaryRows,
    [],
    headerRow,
    ...orderedRows,
  ];

  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  sheet['!cols'] = headerRow.map((_, i) => ({ wch: i === 2 ? 26 : 16 }));
  sheet['!merges'] = [{ s: { r: titleRowIndex, c: 0 }, e: { r: titleRowIndex, c: colCount - 1 } }];

  function setStyle(row: number, col: number, style: unknown) {
    const address = XLSX.utils.encode_cell({ r: row, c: col });
    const cell = sheet[address];
    if (cell) cell.s = style;
  }

  setStyle(titleRowIndex, 0, titleStyle);

  summaryRows.forEach((row, i) => {
    const r = summaryStartRow + i;
    setStyle(r, 0, summaryLabelStyle);
    row.slice(1).forEach((_, ci) => setStyle(r, ci + 1, summaryValueStyle));
  });

  headerRow.forEach((_, c) => setStyle(headerRowIndex, c, tableHeaderStyle));
  orderedRows.forEach((row, ri) => {
    row.forEach((_, c) => setStyle(dataStartRow + ri, c, tableCellStyle));
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Jurnal');

  const fileName = `${counterpartyName.replace(/[^\p{L}\p{N}_-]+/gu, '_')}_jurnal.xlsx`;
  XLSX.writeFile(workbook, fileName);
}
