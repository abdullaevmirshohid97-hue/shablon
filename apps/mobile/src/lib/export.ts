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
function invoiceHtml(counterpartyName: string, transactions: LedgerTransaction[]): string {
  const rows = toRows(transactions).reverse();
  const balance = currentBalanceLabel(transactions);
  const today = formatDate(new Date().toISOString());

  const body = rows
    .map(
      (r) => `<tr>
        <td>${r.date}</td>
        <td>${escapeHtml(r.description)}</td>
        <td class="num">${r.kg}</td>
        <td class="num">${r.dona}</td>
        <td class="num chiqim">${r.chiqim}</td>
        <td class="num kirim">${r.kirim}</td>
        <td>${r.due}</td>
      </tr>`,
    )
    .join('');

  return `<!doctype html><html><head><meta charset="utf-8" />
  <style>
    * { font-family: -apple-system, Roboto, Arial, sans-serif; }
    body { padding: 24px; color: #000000; }
    h1 { font-size: 20px; margin: 0 0 2px; }
    .muted { color: #5C5C64; font-size: 12px; }
    .balance { margin: 14px 0; padding: 12px 14px; background: #F4F4F5; border-radius: 10px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
    th, td { border-bottom: 1px solid #E9E9EB; padding: 6px 8px; text-align: left; }
    th { background: #FAFAFA; font-size: 10px; text-transform: uppercase; color: #5C5C64; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .chiqim { color: #A33A3A; }
    .kirim { color: #2E7D48; }
  </style></head><body>
    <h1>idaa finance — Hisob-faktura</h1>
    <div class="muted">Mijoz: <b>${escapeHtml(counterpartyName)}</b> · Sana: ${today}</div>
    <div class="balance">Joriy saldo: ${balance}</div>
    <table>
      <thead><tr>${HEADERS.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${body || `<tr><td colspan="7">Yozuvlar yo'q</td></tr>`}</tbody>
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
