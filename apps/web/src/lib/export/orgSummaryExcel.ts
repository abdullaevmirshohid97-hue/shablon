import * as XLSX from 'xlsx-js-style';
import {
  buildStatements,
  dictionaries,
  translate,
  type CounterpartyStatement,
  type LedgerTransaction,
  type Locale,
  type PeriodRange,
} from '@mubosher/shared';
import {
  buildStatementSheet,
  formatReportDate,
  formatReportDateTime,
  makeReportId,
} from './ledgerExcel';
import {
  balanceCellStyle,
  centerCellStyle,
  columnWidths,
  headlineLabelStyle,
  headlineValueStyle,
  moneyCellStyle,
  noteStyle,
  overdueLabelStyle,
  overdueValueStyle,
  safeSheetName,
  sanitizeFileName,
  sectionStyle,
  SheetBuilder,
  subtitleStyle,
  tableCellStyle,
  tableHeaderStyle,
  titleStyle,
  totalsMoneyStyle,
  totalsRowStyle,
  warningStyle,
  type CellValue,
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
  /** Set means the client was put away (0036). They keep their debt, so they keep their line. */
  archivedAt?: string | null;
}

export interface OrgSummaryExportInput {
  title: string;
  counterparties: SummaryCounterparty[];
  transactions: LedgerTransaction[];
  locale: Locale;
  baseCurrency?: string;
  orgName?: string | null;
  range?: PeriodRange | null;
  today?: Date;
}

/**
 * The org-wide (or single-module) report a manager hands over.
 *
 * A "Xulosa" tab first: what the whole book is owed, how much of it is late
 * and how late, then one line per client carrying the same figures. Behind it,
 * the full statement of every client that had activity, each on its own tab —
 * built by the very same `buildStatementSheet`, from the very same
 * `buildStatement`, so a summary line and the sheet it points at cannot state
 * two different balances.
 */
export function exportOrgSummaryToExcel(input: OrgSummaryExportInput): void {
  const {
    title,
    counterparties,
    transactions,
    locale,
    baseCurrency = 'UZS',
    orgName = null,
    range = null,
    today,
  } = input;

  const dict = dictionaries[locale];
  const tr = (path: string) => translate(dict, path);
  const reportId = makeReportId();

  const built = buildStatements(counterparties, transactions, { range, today })
    // A client who was put away still owing money belongs in the org's report
    // of what it is owed; one who was put away square does not.
    .filter(
      ({ counterparty, statement }) =>
        !counterparty.archivedAt || statement.closingBalance !== 0 || statement.lines.length > 0,
    )
    .sort((a, b) => b.statement.closingBalance - a.statement.closingBalance);

  const withActivity = built.filter((b) => b.statement.lines.length > 0);
  const detailsOmitted = withActivity.length > MAX_DETAIL_SHEETS;

  const columns: {
    header: string;
    value: (s: CounterpartyStatement, c: SummaryCounterparty) => CellValue;
    style?: unknown;
    total?: (rows: CounterpartyStatement[]) => number;
  }[] = [
    {
      header: tr('export.client'),
      value: (_s, c) => c.name,
      style: tableCellStyle,
    },
    {
      header: tr('export.openingBalance'),
      value: (s) => s.openingBalance || null,
      style: moneyCellStyle,
      total: (rows) => rows.reduce((a, s) => a + s.openingBalance, 0),
    },
    {
      header: tr('analytics.totalKirim'),
      value: (s) => s.debitTurnover || null,
      style: moneyCellStyle,
      total: (rows) => rows.reduce((a, s) => a + s.debitTurnover, 0),
    },
    {
      header: tr('analytics.totalChiqim'),
      value: (s) => s.creditTurnover || null,
      style: moneyCellStyle,
      total: (rows) => rows.reduce((a, s) => a + s.creditTurnover, 0),
    },
    {
      header: tr('analytics.debtChange'),
      value: (s) => s.netChange || null,
      style: moneyCellStyle,
      total: (rows) => rows.reduce((a, s) => a + s.netChange, 0),
    },
    {
      header: tr('export.closingBalance'),
      value: (s) => s.closingBalance,
      style: balanceCellStyle,
      total: (rows) => rows.reduce((a, s) => a + s.closingBalance, 0),
    },
    {
      header: tr('analytics.overdueTotal'),
      value: (s) => s.overdueAmount || null,
      style: overdueValueStyle,
      total: (rows) => rows.reduce((a, s) => a + s.overdueAmount, 0),
    },
    ...['export.aging1', 'export.aging2', 'export.aging3', 'export.aging4'].map((key, i) => ({
      header: tr(key),
      value: (s: CounterpartyStatement) => s.aging[i]?.amount || null,
      style: moneyCellStyle,
      total: (rows: CounterpartyStatement[]) =>
        rows.reduce((a, s) => a + (s.aging[i]?.amount ?? 0), 0),
    })),
    {
      header: tr('export.notYetDue'),
      value: (s) => s.notYetDue || null,
      style: moneyCellStyle,
      total: (rows) => rows.reduce((a, s) => a + s.notYetDue, 0),
    },
    {
      header: tr('overview.overdueSince'),
      value: (s) => formatReportDate(s.overdueDate),
      style: centerCellStyle,
    },
    {
      header: tr('overview.nextDue'),
      value: (s) => formatReportDate(s.nextDueDate),
      style: centerCellStyle,
    },
    {
      header: tr('export.entryCount'),
      value: (s) => s.lines.length || null,
      style: { ...moneyCellStyle, numFmt: '#,##0' },
      total: (rows) => rows.reduce((a, s) => a + s.lines.length, 0),
    },
    {
      header: tr('export.status'),
      value: (_s, c) => (c.archivedAt ? tr('export.archived') : ''),
      style: centerCellStyle,
    },
  ];

  const width = columns.length;
  const statements = built.map((b) => b.statement);
  const sheet = new SheetBuilder();

  sheet.banner(title, width, titleStyle);
  sheet.banner(
    [orgName && orgName !== title ? orgName : null, tr('export.summarySheet')]
      .filter(Boolean)
      .join(' — '),
    width,
    subtitleStyle,
  );
  sheet.banner(
    [
      `${tr('export.period')}: ${
        range
          ? `${formatReportDate(range.start)} — ${formatReportDate(range.end)}`
          : tr('export.periodAll')
      }`,
      `${tr('export.generatedAt')}: ${formatReportDateTime()}`,
      `${tr('export.baseCurrency')}: ${baseCurrency}`,
      `${tr('export.reportId')}: ${reportId}`,
      `${tr('export.clientCount')}: ${built.length}`,
    ].join('   •   '),
    width,
    subtitleStyle,
  );
  sheet.blank();

  // ---------------------------------------------------------------
  // The book at a glance, before the client-by-client detail.
  // ---------------------------------------------------------------
  const totalDebt = statements.reduce((a, s) => a + Math.max(s.closingBalance, 0), 0);
  const totalAdvance = statements.reduce((a, s) => a + Math.max(-s.closingBalance, 0), 0);
  const totalOverdue = statements.reduce((a, s) => a + s.overdueAmount, 0);
  const debtorCount = statements.filter((s) => s.closingBalance > 0).length;
  const lateCount = statements.filter((s) => s.overdueAmount > 0).length;

  sheet.banner(tr('export.summarySection'), width, sectionStyle);
  sheet.push([
    { value: tr('export.totalDebt'), style: headlineLabelStyle },
    { value: round2(totalDebt), style: headlineValueStyle },
    {
      value: tr('export.debtorsRatio')
        .replace('{n}', String(debtorCount))
        .replace('{total}', String(built.length)),
      style: noteStyle,
    },
  ]);
  sheet.push([
    { value: tr('analytics.overdueTotal'), style: overdueLabelStyle },
    { value: round2(totalOverdue), style: overdueValueStyle },
    {
      value: tr('analytics.overdueNote').replace('{n}', String(lateCount)),
      style: noteStyle,
    },
  ]);
  if (totalAdvance > 0) {
    sheet.push([
      { value: tr('export.advance'), style: headlineLabelStyle },
      { value: round2(totalAdvance), style: headlineValueStyle },
    ]);
  }
  if (detailsOmitted) {
    sheet.banner(tr('export.detailsOmitted'), width, warningStyle);
  }
  sheet.blank();

  // ---------------------------------------------------------------
  // One line per client.
  // ---------------------------------------------------------------
  const headerRow = sheet.push(
    columns.map((col) => ({ value: col.header, style: tableHeaderStyle })),
  );
  for (const { counterparty, statement } of built) {
    sheet.push(
      columns.map((col) => ({
        value: col.value(statement, counterparty),
        style: col.style ?? tableCellStyle,
      })),
    );
  }
  const lastDataRow = sheet.rowCount - 1;
  sheet.push(
    columns.map((col, i) => ({
      value: i === 0 ? tr('export.total') : col.total ? round2(col.total(statements)) : null,
      style: i === 0 ? totalsRowStyle : col.total ? totalsMoneyStyle : totalsRowStyle,
    })),
  );

  const summarySheet = sheet.toSheet({
    widths: columnWidths([
      columns.map((c) => c.header),
      ...built
        .slice(0, 400)
        .map(({ counterparty, statement }) => columns.map((c) => c.value(statement, counterparty))),
    ]).map((w, i) => (i === 0 ? Math.max(w, 26) : w)),
    autoFilter: built.length
      ? `${XLSX.utils.encode_cell({ r: headerRow, c: 0 })}:${XLSX.utils.encode_cell({
          r: lastDataRow,
          c: width - 1,
        })}`
      : undefined,
  });

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
    for (const { counterparty, statement } of withActivity) {
      XLSX.utils.book_append_sheet(
        workbook,
        buildStatementSheet({
          counterpartyName: counterparty.name,
          statement,
          locale,
          baseCurrency,
          orgName: orgName ?? title,
          reportId,
          archived: Boolean(counterparty.archivedAt),
        }),
        safeSheetName(counterparty.name, usedNames),
      );
    }
  }

  const suffix = range ? `_${range.start}_${range.end}` : '';
  XLSX.writeFile(workbook, `${sanitizeFileName(title)}_hisobot${suffix}_${reportId}.xlsx`);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
