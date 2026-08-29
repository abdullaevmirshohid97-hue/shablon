import * as XLSX from 'xlsx-js-style';
import {
  amountInWords,
  buildStatement,
  currencyWords,
  dictionaries,
  translate,
  type CounterpartyStatement,
  type LedgerTransaction,
  type Locale,
  type PeriodRange,
  type StatementLine,
} from '@mubosher/shared';
import {
  balanceCellStyle,
  centerCellStyle,
  columnWidths,
  headlineLabelStyle,
  headlineValueStyle,
  intCellStyle,
  moneyCellStyle,
  noteStyle,
  overdueLabelStyle,
  overdueValueStyle,
  qtyCellStyle,
  rateCellStyle,
  safeSheetName,
  sanitizeFileName,
  sectionStyle,
  SheetBuilder,
  subtitleStyle,
  summaryLabelStyle,
  summaryTextValueStyle,
  summaryValueStyle,
  tableCellStyle,
  tableHeaderStyle,
  titleStyle,
  totalsMoneyStyle,
  totalsQtyStyle,
  totalsRowStyle,
  voidedCellStyle,
  voidedMoneyCellStyle,
  type CellValue,
} from './styles';

/**
 * One client's account statement, laid out the way a bank lays one out:
 * who it is for and over what period, the balances block (opening, turnover,
 * closing), how old the debt is, then the entries with a running balance.
 *
 * The figures are not computed here. `buildStatement` in @mubosher/shared is
 * the single source for them — the same one the screen reads — because this
 * file used to carry its own copy of the arithmetic and the two had drifted:
 * it summed raw amounts across currencies, counted unposted drafts, and still
 * used the overdue formula that 0031 replaced for reporting money the client
 * had already paid as debt they still owed.
 */

export interface StatementSheetInput {
  counterpartyName: string;
  statement: CounterpartyStatement;
  locale: Locale;
  baseCurrency: string;
  orgName?: string | null;
  reportId?: string | null;
  archived?: boolean;
}

interface Column {
  header: string;
  /** Kept narrow-to-wide by the width pass; this only nudges a floor. */
  minWidth?: number;
  value: (line: StatementLine) => CellValue;
  style: (line: StatementLine) => unknown;
  total?: CellValue;
  totalStyle?: unknown;
}

/**
 * dd.mm.yyyy, fixed.
 *
 * A document that leaves the building should read the same to everyone who
 * opens it. `toLocaleDateString` gave 05/01/2026 in one runtime and 5.1.2026
 * in another, and 05/01 is a different day depending on who is reading it.
 */
export function formatReportDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function formatRange(range: PeriodRange): string {
  return `${formatReportDate(range.start)} — ${formatReportDate(range.end)}`;
}

/** The same fixed shape as `formatReportDate`, with the time of day. */
export function formatReportDateTime(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${formatReportDate(now.toISOString())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

/** A short, sortable identifier so a forwarded file can be traced back. */
export function makeReportId(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    '-',
    pad(now.getHours()),
    pad(now.getMinutes()),
  ].join('');
}

export function buildStatementSheet(input: StatementSheetInput): XLSX.WorkSheet {
  const { counterpartyName, statement, locale, baseCurrency, orgName, reportId, archived } = input;
  const dict = dictionaries[locale];
  const tr = (path: string) => translate(dict, path);

  const statusLabel = (line: StatementLine): string => {
    if (line.status === 'draft') return tr('ledger.statusDraft');
    if (line.status === 'reversed') return tr('ledger.statusReversed');
    if (line.status === 'reversal') return tr('ledger.statusReversal');
    return tr('ledger.statusPosted');
  };

  // The original-currency block earns its four columns only when there is
  // something to convert. In a single-currency org it is four columns of
  // "UZS" and "1.0000" between the reader and the figures they came for.
  const showCurrency =
    statement.currencies.length > 1 || statement.lines.some((l) => l.exchangeRate !== 1);

  const cell = (line: StatementLine, base: unknown, voided: unknown) =>
    line.status === 'reversed' || !line.counted ? voided : base;

  const columns: Column[] = [
    {
      header: tr('ledger.date'),
      value: (l) => formatReportDate(l.occurredAt),
      style: (l) => cell(l, tableCellStyle, voidedCellStyle),
    },
    {
      header: tr('ledger.documentNo'),
      value: (l) => l.documentNo ?? '',
      style: (l) => cell(l, tableCellStyle, voidedCellStyle),
    },
    {
      header: tr('ledger.process'),
      minWidth: 24,
      value: (l) => l.description ?? '',
      style: (l) => cell(l, tableCellStyle, voidedCellStyle),
    },
    {
      header: tr('analytics.category'),
      value: (l) => l.categoryName ?? '',
      style: (l) => cell(l, tableCellStyle, voidedCellStyle),
    },
    {
      header: tr('ledger.kg'),
      value: (l) => l.quantityKg ?? null,
      style: (l) => cell(l, qtyCellStyle, voidedMoneyCellStyle),
      total: sum(statement.lines, (l) => l.quantityKg ?? 0) || null,
      totalStyle: totalsQtyStyle,
    },
    {
      header: tr('ledger.dona'),
      value: (l) => l.quantityDona ?? null,
      style: (l) => cell(l, qtyCellStyle, voidedMoneyCellStyle),
      total: sum(statement.lines, (l) => l.quantityDona ?? 0) || null,
      totalStyle: totalsQtyStyle,
    },
  ];

  if (showCurrency) {
    columns.push(
      {
        header: `${tr('ledger.kirimSumma')}\n(${tr('export.originalAmount')})`,
        value: (l) => l.debit || null,
        style: (l) => cell(l, moneyCellStyle, voidedMoneyCellStyle),
      },
      {
        header: `${tr('ledger.chiqimSumma')}\n(${tr('export.originalAmount')})`,
        value: (l) => l.credit || null,
        style: (l) => cell(l, moneyCellStyle, voidedMoneyCellStyle),
      },
      {
        header: tr('rates.currency'),
        value: (l) => l.currency,
        style: () => centerCellStyle,
      },
      {
        header: tr('export.rate'),
        value: (l) => l.exchangeRate,
        style: () => rateCellStyle,
      },
    );
  }

  columns.push(
    {
      header: showCurrency
        ? `${tr('ledger.kirimSumma')}\n(${baseCurrency})`
        : tr('ledger.kirimSumma'),
      value: (l) => l.baseDebit || null,
      style: (l) => cell(l, moneyCellStyle, voidedMoneyCellStyle),
      total: statement.debitTurnover,
      totalStyle: totalsMoneyStyle,
    },
    {
      header: showCurrency
        ? `${tr('ledger.chiqimSumma')}\n(${baseCurrency})`
        : tr('ledger.chiqimSumma'),
      value: (l) => l.baseCredit || null,
      style: (l) => cell(l, moneyCellStyle, voidedMoneyCellStyle),
      total: statement.creditTurnover,
      totalStyle: totalsMoneyStyle,
    },
    {
      header: tr('ledger.chiqimMuddati'),
      value: (l) => formatReportDate(l.dueDate),
      style: (l) => cell(l, centerCellStyle, voidedCellStyle),
    },
    {
      header: tr('export.daysOverdue'),
      value: (l) => l.daysOverdue ?? null,
      style: (l) => cell(l, intCellStyle, voidedMoneyCellStyle),
    },
    {
      header: tr('ledger.balance'),
      value: (l) => l.balanceAfter,
      style: () => balanceCellStyle,
      total: statement.closingBalance,
      totalStyle: totalsMoneyStyle,
    },
    {
      header: tr('export.status'),
      value: statusLabel,
      style: (l) => cell(l, centerCellStyle, voidedCellStyle),
    },
  );

  const width = columns.length;
  const sheet = new SheetBuilder();

  // ---------------------------------------------------------------
  // Who, what, when
  // ---------------------------------------------------------------
  sheet.banner(
    archived ? `${counterpartyName} (${tr('export.archived')})` : counterpartyName,
    width,
    titleStyle,
  );
  sheet.banner(
    [orgName, tr('export.statementTitle')].filter(Boolean).join(' — '),
    width,
    subtitleStyle,
  );
  sheet.banner(
    [
      `${tr('export.period')}: ${
        statement.range ? formatRange(statement.range) : tr('export.periodAll')
      }`,
      `${tr('export.generatedAt')}: ${formatReportDateTime()}`,
      `${tr('export.baseCurrency')}: ${baseCurrency}`,
      reportId ? `${tr('export.reportId')}: ${reportId}` : null,
    ]
      .filter(Boolean)
      .join('   •   '),
    width,
    subtitleStyle,
  );
  sheet.blank();

  // ---------------------------------------------------------------
  // Balances. Opening, what moved, closing — in that order, because that is
  // the one arithmetic a reader checks by eye before trusting anything below.
  // ---------------------------------------------------------------
  sheet.banner(tr('export.summarySection'), width, sectionStyle);
  const money = (label: string, value: number) =>
    sheet.push([
      { value: label, style: summaryLabelStyle },
      { value, style: summaryValueStyle },
    ]);

  // Over the whole history the opening figure is always zero, and a zero
  // nobody asked for is one more line between the reader and the total.
  if (statement.range) money(tr('export.openingBalance'), statement.openingBalance);
  money(tr('export.debitTurnover'), statement.debitTurnover);
  money(tr('export.creditTurnover'), statement.creditTurnover);
  money(tr('analytics.debtChange'), statement.netChange);
  sheet.push([
    { value: tr('export.closingBalance'), style: headlineLabelStyle },
    { value: statement.closingBalance, style: headlineValueStyle },
  ]);
  // The figure, in words. What makes a printed sum hard to alter after it has
  // been signed, and what every form in this region has a line for.
  sheet.push([
    { value: tr('export.inWords'), style: summaryLabelStyle },
    {
      value: amountInWords(statement.closingBalance, locale, currencyWords(baseCurrency, locale)),
      style: { ...summaryTextValueStyle, alignment: { horizontal: 'left' } },
    },
  ]);

  if (statement.overdueAmount > 0) {
    sheet.push([
      { value: tr('analytics.overdueTotal'), style: overdueLabelStyle },
      { value: statement.overdueAmount, style: overdueValueStyle },
      {
        value: statement.overdueDate
          ? `${tr('overview.overdueSince')}: ${formatReportDate(statement.overdueDate)}`
          : '',
        style: noteStyle,
      },
    ]);
  }
  if (statement.totalDebt > 0) money(tr('export.notYetDue'), statement.notYetDue);
  if (statement.advance > 0) money(tr('export.advance'), statement.advance);
  if (statement.nextDueDate) {
    sheet.push([
      { value: tr('overview.nextDue'), style: summaryLabelStyle },
      { value: formatReportDate(statement.nextDueDate), style: summaryTextValueStyle },
    ]);
  }
  sheet.push([
    { value: tr('export.entryCount'), style: summaryLabelStyle },
    { value: statement.lines.length, style: { ...summaryTextValueStyle, numFmt: '#,##0' } },
  ]);

  // ---------------------------------------------------------------
  // How old the debt is. A single "overdue" total says a client is late;
  // this says whether they are a week late or a season late, which is the
  // difference between a phone call and a lawyer.
  // ---------------------------------------------------------------
  if (statement.overdueAmount > 0) {
    sheet.blank();
    sheet.banner(tr('export.agingSection'), width, sectionStyle);
    const labels = ['export.aging1', 'export.aging2', 'export.aging3', 'export.aging4'];
    sheet.push(statement.aging.map((_, i) => ({ value: tr(labels[i]!), style: tableHeaderStyle })));
    sheet.push(
      statement.aging.map((bucket) => ({
        value: bucket.amount || null,
        style: bucket.amount > 0 ? overdueValueStyle : moneyCellStyle,
      })),
    );
  }

  // ---------------------------------------------------------------
  // Anything that would make a reader mistrust the figures, said out loud.
  // ---------------------------------------------------------------
  const notes: string[] = [];
  if (statement.draftCount > 0) {
    notes.push(tr('export.draftsExcluded').replace('{n}', String(statement.draftCount)));
  }
  if (statement.reversedCount > 0) {
    notes.push(tr('export.reversedNote').replace('{n}', String(statement.reversedCount)));
  }
  if (showCurrency) {
    notes.push(
      tr('export.mixedCurrency')
        .replace('{list}', statement.currencies.join(', '))
        .replace('{base}', baseCurrency),
    );
  }
  if (notes.length) {
    sheet.blank();
    sheet.banner(tr('export.notesSection'), width, sectionStyle);
    for (const note of notes) sheet.banner(note, width, noteStyle);
  }

  // ---------------------------------------------------------------
  // The entries. Oldest first: the balance column accumulates downward, and
  // reading it in reverse — which is what the newest-first export used to
  // print — makes every figure in it look wrong.
  // ---------------------------------------------------------------
  sheet.blank();
  const headerRow = sheet.push(
    columns.map((col) => ({ value: col.header, style: tableHeaderStyle })),
  );

  if (statement.range && statement.openingBalance !== 0) {
    const opening: (CellValue | { value: CellValue; style: unknown })[] = columns.map(() => ({
      value: null as CellValue,
      style: totalsRowStyle,
    }));
    opening[0] = { value: tr('export.openingBalance'), style: totalsRowStyle };
    opening[columns.length - 2] = {
      value: statement.openingBalance,
      style: totalsMoneyStyle,
    };
    sheet.push(opening);
  }

  for (const line of statement.lines) {
    sheet.push(columns.map((col) => ({ value: col.value(line), style: col.style(line) })));
  }
  const lastDataRow = sheet.rowCount - 1;

  sheet.push(
    columns.map((col, i) => ({
      value: i === 0 ? tr('export.total') : (col.total ?? null),
      style: i === 0 ? totalsRowStyle : (col.totalStyle ?? totalsRowStyle),
    })),
  );

  const built = sheet.toSheet({
    widths: widthsFor(columns, statement),
    autoFilter:
      statement.lines.length > 0
        ? `${XLSX.utils.encode_cell({ r: headerRow, c: 0 })}:${XLSX.utils.encode_cell({
            r: lastDataRow,
            c: columns.length - 1,
          })}`
        : undefined,
  });

  return built;
}

function sum(lines: StatementLine[], pick: (l: StatementLine) => number): number {
  return Math.round(lines.reduce((acc, l) => acc + pick(l), 0) * 1000) / 1000;
}

/** Sampled rather than exhaustive: 400 rows settle the width, and a
 * fifty-thousand-row ledger should not pay for measuring every one of them. */
function widthsFor(columns: Column[], statement: CounterpartyStatement): number[] {
  const sample = [
    columns.map((c) => c.header),
    ...statement.lines.slice(0, 400).map((l) => columns.map((c) => c.value(l))),
  ];
  return columnWidths(sample).map((w, i) => Math.max(w, columns[i]?.minWidth ?? 0));
}

export interface LedgerExportInput {
  counterpartyName: string;
  transactions: LedgerTransaction[];
  locale: Locale;
  baseCurrency?: string;
  orgName?: string | null;
  range?: PeriodRange | null;
  today?: Date;
}

export function exportLedgerToExcel(input: LedgerExportInput): void {
  const {
    counterpartyName,
    transactions,
    locale,
    baseCurrency = 'UZS',
    orgName = null,
    range = null,
    today,
  } = input;

  const statement = buildStatement(transactions, { range, today });
  const reportId = makeReportId();
  const sheet = buildStatementSheet({
    counterpartyName,
    statement,
    locale,
    baseCurrency,
    orgName,
    reportId,
  });

  const workbook = XLSX.utils.book_new();
  const dict = dictionaries[locale];
  XLSX.utils.book_append_sheet(
    workbook,
    sheet,
    safeSheetName(translate(dict, 'export.statementTitle'), new Set()),
  );

  const suffix = range ? `_${range.start}_${range.end}` : '';
  XLSX.writeFile(
    workbook,
    `${sanitizeFileName(counterpartyName)}_kochirma${suffix}_${reportId}.xlsx`,
  );
}
