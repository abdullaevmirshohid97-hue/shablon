const hasIntl = typeof Intl !== 'undefined' && typeof Intl.NumberFormat === 'function';

const moneyFormatter = hasIntl
  ? new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  : null;

/** 1234567.5 -> "1 234 567,5" (matches the web ledger's ru-RU grouping). */
export function formatMoney(value: number): string {
  if (moneyFormatter) return moneyFormatter.format(value);
  const fixed = Math.abs(value).toFixed(2);
  const dot = fixed.indexOf('.');
  const whole = fixed.slice(0, dot);
  const frac = fixed.slice(dot + 1);
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const sign = value < 0 ? '-' : '';
  return frac === '00' ? `${sign}${grouped}` : `${sign}${grouped},${frac}`;
}

/** ISO date/datetime -> "dd.mm.yyyy". */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${d.getFullYear()}`;
}

/** Today's date as an ISO yyyy-mm-dd string (local timezone). */
export function todayIso(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}
