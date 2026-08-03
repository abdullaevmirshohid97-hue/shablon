import { Alert, Linking, Share } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from 'xlsx-js-style';
import { computeRunningBalance, type LedgerTransaction } from '@mubosher/shared';
import { formatDate, formatMoney } from './format';

/** One normalised ledger line, oldest-first order preserved by the caller. */
interface Row {
  date: string;
  documentNo: string;
  description: string;
  kg: string;
  dona: string;
  chiqim: string;
  kirim: string;
  due: string;
}

function txIsChiqim(t: LedgerTransaction): boolean {
  return t.creditAccountType === 'receivable';
}

function toRows(transactions: LedgerTransaction[]): Row[] {
  return transactions.map((t) => {
    const isChiqim = txIsChiqim(t);
    const kg = t.quantityKg ?? (t.unit === 'kg' ? t.quantity : null);
    const dona = t.quantityDona ?? (t.unit === 'dona' ? t.quantity : null);
    return {
      date: formatDate(t.occurredAt),
      documentNo: t.documentNo ?? '',
      description: t.description ?? t.categoryName ?? '',
      kg: kg != null ? formatMoney(kg) : '',
      dona: dona != null ? formatMoney(dona) : '',
      chiqim: isChiqim ? formatMoney(t.creditAmount) : '',
      kirim: t.debitAccountType === 'receivable' ? formatMoney(t.debitAmount) : '',
      due: isChiqim && t.dueDate ? formatDate(t.dueDate) : '',
    };
  });
}

/** Bizga qarzdor (+) / Biz qarzdormiz (−) joriy saldo. */
export function currentBalanceLabel(transactions: LedgerTransaction[]): string {
  const balances = computeRunningBalance(transactions);
  const last = balances[balances.length - 1];
  if (!last || last.balance === 0) return '0';
  const sign = last.side === 'debit' ? '' : '−';
  const who = last.side === 'debit' ? 'Bizga qarzdor' : 'Biz qarzdormiz';
  return `${sign}${formatMoney(last.balance)} so'm (${who})`;
}

function safeName(name: string): string {
  return name.replace(/[^\p{L}\p{N}_-]+/gu, '_') || 'jurnal';
}

const HEADERS = ['Sana', 'Izoh', 'Kg', 'Dona', 'Chiqim', 'Kirim', 'Srok'];

// ── CSV ────────────────────────────────────────────────────────────────
function toCsv(rows: Row[]): string {
  const esc = (v: string) => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [HEADERS.join(';')];
  for (const r of rows) {
    lines.push([r.date, r.description, r.kg, r.dona, r.chiqim, r.kirim, r.due].map(esc).join(';'));
  }
  // BOM so Excel opens UTF-8 (Cyrillic/Latin) correctly.
  return '﻿' + lines.join('\n');
}

async function writeAndShare(
  fileName: string,
  content: string,
  encoding: FileSystem.EncodingType,
  mimeType: string,
  dialogTitle: string,
) {
  const uri = (FileSystem.cacheDirectory ?? '') + fileName;
  await FileSystem.writeAsStringAsync(uri, content, { encoding });
  if (!(await Sharing.isAvailableAsync())) {
    Alert.alert('Ulashish mavjud emas', 'Bu qurilmada ulashish imkoni topilmadi.');
    return;
  }
  await Sharing.shareAsync(uri, { mimeType, dialogTitle, UTI: mimeType });
}

export async function exportCsv(counterpartyName: string, transactions: LedgerTransaction[]) {
  const rows = toRows(transactions).reverse(); // newest first, like the screen
  await writeAndShare(
    `${safeName(counterpartyName)}_jurnal.csv`,
    toCsv(rows),
    FileSystem.EncodingType.UTF8,
    'text/csv',
    'CSV ulashish',
  );
}

export async function exportExcel(counterpartyName: string, transactions: LedgerTransaction[]) {
  const rows = toRows(transactions)
    .reverse()
    .map((r) => ({
      Sana: r.date,
      Izoh: r.description,
      Kg: r.kg,
      Dona: r.dona,
      Chiqim: r.chiqim,
      Kirim: r.kirim,
      Srok: r.due,
    }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = HEADERS.map(() => ({ wch: 16 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Jurnal');
  const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  await writeAndShare(
    `${safeName(counterpartyName)}_jurnal.xlsx`,
    base64,
    FileSystem.EncodingType.Base64,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Excel ulashish',
  );
}

// ── PDF / invoice ──────────────────────────────────────────────────────

/** A4 landscape in points (72dpi) — what expo-print wants, and what the web
 *  app's own print stylesheet asks for via `@page`. Nine columns of figures
 *  do not fit portrait Letter, which is what expo-print defaults to. */
const PAGE_WIDTH_PT = 842;
const PAGE_HEIGHT_PT = 595;

/** 10mm in points, matching the web stylesheet's `@page { margin: 10mm }`.
 *  expo-print's `margins` option is iOS-only; Android takes it from @page. */
const PAGE_MARGIN_PT = 28;

/** Same column set as the web ledger, so a PDF from a phone and a PDF from a
 *  desktop are the same document. */
const PDF_HEADERS = [
  'Sana',
  'Hujjat №',
  'Jarayon',
  'Kg',
  'Dona',
  'Chiqim',
  'Kirim',
  'Srok',
  'Joriy saldo',
];

/** Column widths as percentages, in PDF_HEADERS order. Fixed rather than
 *  auto: left to itself the description column starves the amount columns
 *  until figures wrap mid-number. */
const PDF_COL_WIDTHS = ['8%', '9%', '25%', '7%', '7%', '12%', '12%', '9%', '11%'];

/** Indices of PDF_HEADERS that hold figures — right-aligned, header included. */
const PDF_NUMERIC_COLUMNS = new Set([3, 4, 5, 6, 8]);

function balanceCell(entry: { balance: number; side: 'debit' | 'credit' } | undefined): string {
  if (!entry) return '';
  if (entry.balance === 0) return '0';
  return `${entry.side === 'debit' ? '' : '−'}${formatMoney(entry.balance)}`;
}

function invoiceHtml(counterpartyName: string, transactions: LedgerTransaction[]): string {
  // Balances accumulate oldest-first; the table is shown newest-first, like
  // the screen. Pair each row with its balance BEFORE reversing, or every
  // line gets somebody else's saldo.
  const balances = computeRunningBalance(transactions);
  const rows = toRows(transactions)
    .map((r, i) => ({ ...r, balance: balanceCell(balances[i]) }))
    .reverse();

  const totalChiqim = transactions.reduce(
    (sum, t) => sum + (t.creditAccountType === 'receivable' ? t.creditAmount : 0),
    0,
  );
  const totalKirim = transactions.reduce(
    (sum, t) => sum + (t.debitAccountType === 'receivable' ? t.debitAmount : 0),
    0,
  );

  const balance = currentBalanceLabel(transactions);
  const today = formatDate(new Date().toISOString());

  const body = rows
    .map(
      (r) => `<tr>
        <td class="nowrap">${r.date}</td>
        <td class="nowrap">${escapeHtml(r.documentNo)}</td>
        <td class="wrap">${escapeHtml(r.description)}</td>
        <td class="num">${r.kg}</td>
        <td class="num">${r.dona}</td>
        <td class="num chiqim">${r.chiqim}</td>
        <td class="num kirim">${r.kirim}</td>
        <td class="nowrap">${r.due}</td>
        <td class="num strong">${r.balance}</td>
      </tr>`,
    )
    .join('');

  return `<!doctype html><html><head><meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    /* Android's print engine honours @page; iOS ignores it and takes the
       page size from expo-print's width/height instead — both are set. */
    @page { size: A4 landscape; margin: 10mm; }

    /* Without this, the print engine drops every background-color, which is
       what separates the header band and the saldo panel from the paper.
       The web app forces the same thing in globals.css. */
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      font-family: -apple-system, Roboto, Arial, sans-serif;
    }

    /* Page margins come from @page (or the platform printer); a body padding
       on top of them would double the inset on Android only. */
    body { margin: 0; padding: 0; color: #000000; }

    h1 { font-size: 16px; margin: 0 0 2px; }
    .muted { color: #5C5C64; font-size: 11px; }
    .balance {
      margin: 10px 0; padding: 8px 12px; background: #F4F4F5;
      border: 1px solid #E9E9EB; border-radius: 8px; font-weight: 700; font-size: 12px;
    }

    table {
      width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 10px;
      table-layout: fixed;
    }
    /* A table taller than the page may break between rows, never inside one,
       and the header band repeats on every page it spills onto. Without these
       a long ledger arrives with rows sliced in half at the page boundary and
       an unlabelled grid of numbers from page two onwards. */
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
    tr { page-break-inside: avoid; break-inside: avoid; }

    th, td {
      border-bottom: 1px solid #D8D8DC;
      padding: 5px 6px; text-align: left; vertical-align: top;
    }
    th {
      background: #F4F4F5; font-size: 9px; text-transform: uppercase;
      letter-spacing: 0.04em; color: #2A2A30; border-bottom: 1px solid #8A8A93;
    }
    /* Numeric headers sit over right-aligned figures, so they align right too
       — otherwise every amount column reads as visibly off its own label. */
    th.num { text-align: right; }

    .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .nowrap { white-space: nowrap; }
    /* A long unbroken description would otherwise run past the last column
       and print over the table's right-hand border. */
    .wrap { overflow-wrap: anywhere; word-break: break-word; }
    .strong { font-weight: 700; }
    .chiqim { color: #A33A3A; }
    .kirim { color: #2E7D48; }

    tfoot td {
      border-top: 1px solid #8A8A93; border-bottom: none;
      font-weight: 700; font-size: 10px; padding-top: 6px;
    }
    .empty { text-align: center; color: #5C5C64; padding: 18px 6px; }
  </style></head><body>
    <h1>idaa finance — Hisob-faktura</h1>
    <div class="muted">Mijoz: <b>${escapeHtml(counterpartyName)}</b> · Sana: ${today} · Yozuvlar: ${rows.length}</div>
    <div class="balance">Joriy saldo: ${balance}</div>
    <table>
      <colgroup>${PDF_COL_WIDTHS.map((w) => `<col style="width:${w}" />`).join('')}</colgroup>
      <thead><tr>${PDF_HEADERS.map(
        (h, i) => `<th class="${PDF_NUMERIC_COLUMNS.has(i) ? 'num' : ''}">${h}</th>`,
      ).join('')}</tr></thead>
      <tbody>${
        body || `<tr><td class="empty" colspan="${PDF_HEADERS.length}">Yozuvlar yo'q</td></tr>`
      }</tbody>
      ${
        rows.length
          ? `<tfoot><tr>
              <td colspan="5">Jami</td>
              <td class="num chiqim">${formatMoney(totalChiqim)}</td>
              <td class="num kirim">${formatMoney(totalKirim)}</td>
              <td></td>
              <td class="num">${balanceCell(balances[balances.length - 1])}</td>
            </tr></tfoot>`
          : ''
      }
    </table>
  </body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );
}

export async function exportPdf(counterpartyName: string, transactions: LedgerTransaction[]) {
  const { uri } = await Print.printToFileAsync({
    html: invoiceHtml(counterpartyName, transactions),
    // iOS takes the page size from here (it ignores @page); Android takes it
    // from the stylesheet. Left unset, expo-print defaults to portrait US
    // Letter and nine columns of figures get crushed into it.
    width: PAGE_WIDTH_PT,
    height: PAGE_HEIGHT_PT,
    margins: {
      top: PAGE_MARGIN_PT,
      right: PAGE_MARGIN_PT,
      bottom: PAGE_MARGIN_PT,
      left: PAGE_MARGIN_PT,
    },
  });
  if (!(await Sharing.isAvailableAsync())) {
    Alert.alert('Ulashish mavjud emas', 'Bu qurilmada ulashish imkoni topilmadi.');
    return;
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: 'PDF ulashish',
    UTI: 'com.adobe.pdf',
  });
}

// ── Telegram ───────────────────────────────────────────────────────────
/** Qisqa oldi-berdi/faktura matni (Telegram xabari uchun). */
export function invoiceText(counterpartyName: string, transactions: LedgerTransaction[]): string {
  const rows = toRows(transactions).reverse().slice(0, 20);
  const lines = rows.map((r) => {
    const amount = r.chiqim ? `− ${r.chiqim}` : r.kirim ? `+ ${r.kirim}` : '';
    const qty = [r.kg && `${r.kg}kg`, r.dona && `${r.dona}dona`].filter(Boolean).join(' ');
    return `${r.date}  ${r.description || ''} ${qty}  ${amount}`.replace(/\s+/g, ' ').trim();
  });
  return [
    `idaa finance — ${counterpartyName}`,
    `Joriy saldo: ${currentBalanceLabel(transactions)}`,
    '',
    ...lines,
    rows.length >= 20 ? '…' : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Faktura matnini ulashish (Telegram/boshqa ilova tanlanadi, matn oldindan to'ladi). */
export async function shareInvoiceText(
  counterpartyName: string,
  transactions: LedgerTransaction[],
) {
  await Share.share({ message: invoiceText(counterpartyName, transactions) });
}

/** Mijozning Telegram chatini raqami bo'yicha ochadi (raqam Telegramda bo'lsa). */
export async function openTelegramChat(phone: string) {
  const digits = phone.replace(/[^\d]/g, '');
  if (!digits) {
    Alert.alert('Raqam yo‘q', 'Bu mijozda telefon raqami kiritilmagan.');
    return;
  }
  const app = `tg://resolve?phone=${digits}`;
  const web = `https://t.me/+${digits}`;
  try {
    const canApp = await Linking.canOpenURL(app);
    await Linking.openURL(canApp ? app : web);
  } catch {
    await Linking.openURL(web);
  }
}
