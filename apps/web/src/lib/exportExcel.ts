import * as XLSX from 'xlsx';
import {
  computeRunningBalance,
  dictionaries,
  translate,
  type LedgerTransaction,
  type Locale,
} from '@mubosher/shared';

export function exportLedgerToExcel(
  counterpartyName: string,
  transactions: LedgerTransaction[],
  locale: Locale,
) {
  const dict = dictionaries[locale];
  const tr = (path: string) => translate(dict, path);
  const dateLocale = locale === 'ru' ? 'ru-RU' : 'uz-UZ';

  // Parallel-indexed to `transactions` (both chronological) — credit side is
  // signed negative so the spreadsheet cell reads as "we owe" out of the box.
  const balances = computeRunningBalance(transactions);

  const rows = transactions.map((t, i) => {
    const isChiqim = t.creditAccountType === 'receivable';
    const bal = balances[i];
    return {
      [tr('ledger.date')]: new Date(t.occurredAt).toLocaleDateString(dateLocale),
      [tr('ledger.documentNo')]: t.documentNo ?? '',
      [tr('ledger.process')]: t.description ?? '',
      [tr('ledger.kg')]: t.quantityKg ?? (t.unit === 'kg' ? t.quantity : '') ?? '',
      [tr('ledger.dona')]: t.quantityDona ?? (t.unit === 'dona' ? t.quantity : '') ?? '',
      [tr('ledger.chiqimSumma')]: isChiqim ? t.creditAmount : '',
      [tr('ledger.kirimSumma')]: t.debitAccountType === 'receivable' ? t.debitAmount : '',
      [tr('ledger.chiqimMuddati')]:
        isChiqim && t.dueDate ? new Date(t.dueDate).toLocaleDateString(dateLocale) : '',
      [tr('ledger.balance')]: bal ? (bal.side === 'credit' ? -bal.balance : bal.balance) : '',
    };
  });

  // The journal shows newest first on screen; the export mirrors that.
  const orderedRows = [...rows].reverse();

  const sheet = XLSX.utils.json_to_sheet(orderedRows);
  sheet['!cols'] = Object.keys(orderedRows[0] ?? {}).map(() => ({ wch: 16 }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Jurnal');

  const fileName = `${counterpartyName.replace(/[^\p{L}\p{N}_-]+/gu, '_')}_jurnal.xlsx`;
  XLSX.writeFile(workbook, fileName);
}
