import * as XLSX from 'xlsx-js-style';

// Shared look for every generated workbook, so the per-client journal and the
// org-wide summary read as one report rather than two different tools.

const BORDER_COLOR = { rgb: 'CBD5E1' }; // slate-300
const thinBorder = { style: 'thin', color: BORDER_COLOR };

export const fullBorder = {
  top: thinBorder,
  bottom: thinBorder,
  left: thinBorder,
  right: thinBorder,
};

export const titleStyle = { font: { bold: true, sz: 14 } };
export const subtitleStyle = { font: { sz: 10, color: { rgb: '64748B' } } }; // slate-500
export const summaryLabelStyle = { font: { bold: true }, border: fullBorder };
export const summaryValueStyle = {
  font: { bold: true },
  border: fullBorder,
  alignment: { horizontal: 'right' },
};
export const tableHeaderStyle = {
  font: { bold: true, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: '475569' } }, // slate-600
  border: fullBorder,
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
};
export const tableCellStyle = { border: fullBorder };
export const totalsRowStyle = {
  font: { bold: true },
  fill: { fgColor: { rgb: 'F1F5F9' } }, // slate-100
  border: fullBorder,
};

export function setStyle(sheet: XLSX.WorkSheet, row: number, col: number, style: unknown): void {
  const address = XLSX.utils.encode_cell({ r: row, c: col });
  const cell = sheet[address];
  if (cell) cell.s = style;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Excel rejects sheet names longer than 31 characters or containing
 * : \ / ? * [ ] — and silently corrupts the file on duplicates, so names are
 * de-duplicated with a numeric suffix that still fits the limit.
 */
export function safeSheetName(name: string, used: Set<string>): string {
  const base = (name.replace(/[:\\/?*[\]]/g, ' ').trim() || 'Sheet').slice(0, 31);

  let candidate = base;
  let n = 2;
  while (used.has(candidate)) {
    const suffix = ` (${n})`;
    candidate = base.slice(0, 31 - suffix.length) + suffix;
    n += 1;
  }

  used.add(candidate);
  return candidate;
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[^\p{L}\p{N}_-]+/gu, '_');
}
