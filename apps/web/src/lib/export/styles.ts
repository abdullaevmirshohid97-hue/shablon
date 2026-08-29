import * as XLSX from 'xlsx-js-style';

// Shared look for every generated workbook, so the per-client statement and
// the org-wide summary read as one report rather than two different tools.

const BORDER_COLOR = { rgb: 'CBD5E1' }; // slate-300
const thinBorder = { style: 'thin', color: BORDER_COLOR };

export const fullBorder = {
  top: thinBorder,
  bottom: thinBorder,
  left: thinBorder,
  right: thinBorder,
};

/**
 * Number formats.
 *
 * Money is written as a real number with a format, never as a pre-formatted
 * string: a statement that cannot be summed, sorted or filtered in Excel is a
 * picture of a report rather than a report. The signed variant prints a credit
 * balance in red and in brackets, which is how an accountant reads "we owe
 * them" without having to check the column heading.
 */
export const MONEY_FMT = '#,##0.00';
export const MONEY_SIGNED_FMT = '#,##0.00;[Red](#,##0.00)';
export const QTY_FMT = '#,##0.###';
export const RATE_FMT = '#,##0.0000';
export const INT_FMT = '#,##0';
export const DATE_FMT = 'dd.mm.yyyy';

export const titleStyle = { font: { bold: true, sz: 15 } };
export const subtitleStyle = { font: { sz: 10, color: { rgb: '64748B' } } }; // slate-500

/** Band that opens a block — Xulosa, Qarz yoshi, Izohlar. */
export const sectionStyle = {
  font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: '334155' } }, // slate-700
  alignment: { vertical: 'center' },
};

export const summaryLabelStyle = { font: { bold: false }, border: fullBorder };
export const summaryValueStyle = {
  font: { bold: true },
  border: fullBorder,
  alignment: { horizontal: 'right' },
  numFmt: MONEY_SIGNED_FMT,
};
export const summaryTextValueStyle = {
  border: fullBorder,
  alignment: { horizontal: 'right' },
};

/** The one figure the whole statement exists to state. */
export const headlineLabelStyle = {
  font: { bold: true },
  fill: { fgColor: { rgb: 'F1F5F9' } }, // slate-100
  border: fullBorder,
};
export const headlineValueStyle = {
  font: { bold: true, sz: 12 },
  fill: { fgColor: { rgb: 'F1F5F9' } },
  border: fullBorder,
  alignment: { horizontal: 'right' },
  numFmt: MONEY_SIGNED_FMT,
};

export const overdueLabelStyle = {
  font: { bold: true, color: { rgb: 'B91C1C' } }, // rose-700
  fill: { fgColor: { rgb: 'FEF2F2' } }, // rose-50
  border: fullBorder,
};
export const overdueValueStyle = {
  font: { bold: true, color: { rgb: 'B91C1C' } },
  fill: { fgColor: { rgb: 'FEF2F2' } },
  border: fullBorder,
  alignment: { horizontal: 'right' },
  numFmt: MONEY_FMT,
};

export const tableHeaderStyle = {
  font: { bold: true, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: '475569' } }, // slate-600
  border: fullBorder,
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
};
export const tableCellStyle = { border: fullBorder, alignment: { vertical: 'center' } };
export const moneyCellStyle = {
  border: fullBorder,
  alignment: { horizontal: 'right', vertical: 'center' },
  numFmt: MONEY_FMT,
};
export const balanceCellStyle = {
  font: { bold: true },
  fill: { fgColor: { rgb: 'F8FAFC' } }, // slate-50
  border: fullBorder,
  alignment: { horizontal: 'right', vertical: 'center' },
  numFmt: MONEY_SIGNED_FMT,
};
export const qtyCellStyle = {
  border: fullBorder,
  alignment: { horizontal: 'right', vertical: 'center' },
  numFmt: QTY_FMT,
};
export const rateCellStyle = {
  border: fullBorder,
  alignment: { horizontal: 'right', vertical: 'center' },
  numFmt: RATE_FMT,
};
export const intCellStyle = {
  border: fullBorder,
  alignment: { horizontal: 'right', vertical: 'center' },
  numFmt: INT_FMT,
};
export const centerCellStyle = {
  border: fullBorder,
  alignment: { horizontal: 'center', vertical: 'center' },
};

/** A line the ledger no longer counts: shown, struck through, greyed. */
export const voidedCellStyle = {
  border: fullBorder,
  font: { color: { rgb: '94A3B8' }, strike: true }, // slate-400
  alignment: { vertical: 'center' },
};
export const voidedMoneyCellStyle = {
  ...voidedCellStyle,
  alignment: { horizontal: 'right', vertical: 'center' },
  numFmt: MONEY_FMT,
};

export const totalsRowStyle = {
  font: { bold: true },
  fill: { fgColor: { rgb: 'E2E8F0' } }, // slate-200
  border: fullBorder,
};
export const totalsMoneyStyle = {
  ...totalsRowStyle,
  alignment: { horizontal: 'right' },
  numFmt: MONEY_SIGNED_FMT,
};
export const totalsQtyStyle = {
  ...totalsRowStyle,
  alignment: { horizontal: 'right' },
  numFmt: QTY_FMT,
};

export const noteStyle = { font: { sz: 10, color: { rgb: '92400E' } } }; // amber-800
export const warningStyle = { font: { bold: true, sz: 10, color: { rgb: 'B91C1C' } } };

export type CellValue = string | number | null;

interface StyledCell {
  value: CellValue;
  style?: unknown;
}

/**
 * Assembles a sheet row by row.
 *
 * The old exports built an array-of-arrays first and then reached back into it
 * by remembered row index to attach styles — which meant every inserted line
 * shifted a handful of magic offsets, and the ones that were missed styled the
 * wrong cell silently. Here a row carries its own formatting as it is written,
 * so the two cannot drift apart.
 */
export class SheetBuilder {
  private rows: StyledCell[][] = [];
  private merges: XLSX.Range[] = [];

  get rowCount(): number {
    return this.rows.length;
  }

  /** Appends a row and returns its index. */
  push(cells: (StyledCell | CellValue)[]): number {
    this.rows.push(
      cells.map((c) => (c !== null && typeof c === 'object' ? c : ({ value: c } as StyledCell))),
    );
    return this.rows.length - 1;
  }

  blank(): number {
    return this.push([]);
  }

  /** A full-width banner: one value, merged across `width` columns. */
  banner(text: string, width: number, style: unknown): number {
    const row = this.push([{ value: text, style }]);
    if (width > 1) {
      this.merges.push({ s: { r: row, c: 0 }, e: { r: row, c: width - 1 } });
    }
    return row;
  }

  merge(range: XLSX.Range): void {
    this.merges.push(range);
  }

  toSheet(options: { widths?: number[]; autoFilter?: string } = {}): XLSX.WorkSheet {
    // A null writes no cell at all, and a cell that does not exist cannot take
    // a border — which left the empty half of every money column outside the
    // grid, so the table read as a handful of boxed figures floating on blank
    // paper. A styled blank is written as an empty string so it gets its box.
    const aoa = this.rows.map((row) =>
      row.map((c) => (c.value === null && c.style ? '' : c.value)),
    );
    const sheet = XLSX.utils.aoa_to_sheet(aoa, { cellDates: false });

    this.rows.forEach((row, r) => {
      row.forEach((cell, c) => {
        if (!cell.style) return;
        const address = XLSX.utils.encode_cell({ r, c });
        const target = sheet[address];
        if (target) target.s = cell.style;
      });
    });

    if (this.merges.length) sheet['!merges'] = this.merges;
    if (options.widths) sheet['!cols'] = options.widths.map((wch) => ({ wch }));
    if (options.autoFilter) sheet['!autofilter'] = { ref: options.autoFilter };

    // Printing an A4 statement with the default one-inch margins throws away a
    // column; these are the narrowest Excel will honour without complaint.
    sheet['!margins'] = { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4 };

    return sheet;
  }
}

/**
 * Column widths from the content, not from a guess.
 *
 * `wch: 16` across the board was leaving four-digit sums swimming in space
 * while client names and descriptions were cut off mid-word.
 */
export function columnWidths(
  rows: (CellValue | { value: CellValue })[][],
  { min = 9, max = 42 }: { min?: number; max?: number } = {},
): number[] {
  const widths: number[] = [];

  for (const row of rows) {
    row.forEach((cell, c) => {
      const value =
        cell !== null && typeof cell === 'object' && 'value' in cell ? cell.value : cell;
      if (value === null || value === undefined) return;
      // A number renders about as wide as its formatted form, which carries
      // group separators and two decimals the raw value does not.
      const text =
        typeof value === 'number'
          ? Math.abs(value).toLocaleString('ru-RU', { minimumFractionDigits: 2 })
          : String(value);
      const longest = Math.max(...text.split('\n').map((line) => line.length));
      widths[c] = Math.max(widths[c] ?? 0, longest);
    });
  }

  return widths.map((w) => Math.min(Math.max((w || 0) + 2, min), max));
}

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
