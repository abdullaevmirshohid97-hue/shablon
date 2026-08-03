import { describe, it, expect, vi } from 'vitest';

const captured: Record<string, unknown> = {};

vi.mock('expo-print', () => ({
  printToFileAsync: async (opts: Record<string, unknown>) => {
    Object.assign(captured, opts);
    return { uri: 'file://t.pdf', numberOfPages: 1 };
  },
}));
vi.mock('expo-sharing', () => ({
  isAvailableAsync: async () => true,
  shareAsync: async () => {},
}));
vi.mock('expo-file-system/legacy', () => ({
  cacheDirectory: '/tmp/',
  writeAsStringAsync: async () => {},
  EncodingType: { UTF8: 'utf8', Base64: 'base64' },
}));
vi.mock('react-native', () => ({
  Alert: { alert: () => {} },
  Linking: {},
  Share: { share: async () => {} },
}));

import { exportPdf } from './export';
import type { LedgerTransaction } from '@mubosher/shared';

function tx(over: Partial<LedgerTransaction>): LedgerTransaction {
  return {
    id: Math.random().toString(),
    orgId: 'o',
    counterpartyId: 'c',
    occurredAt: '2026-01-01T00:00:00Z',
    debitAccountType: 'other',
    debitAmount: 0,
    creditAccountType: 'other',
    creditAmount: 0,
    currency: 'UZS',
    source: 'fabrika',
    status: 'posted',
    ...over,
  } as LedgerTransaction;
}

// Oldest-first, as the caller supplies. Chiqim = credit on receivable (they
// take goods), kirim = debit on receivable (they pay).
const TXS: LedgerTransaction[] = [
  tx({
    occurredAt: '2026-01-01T00:00:00Z',
    documentNo: 'A-1',
    description: 'Birinchi',
    creditAccountType: 'receivable',
    creditAmount: 1000,
    dueDate: '2026-02-01',
  }),
  tx({
    occurredAt: '2026-01-05T00:00:00Z',
    documentNo: 'A-2',
    description: 'Ikkinchi',
    debitAccountType: 'receivable',
    debitAmount: 400,
  }),
  tx({
    occurredAt: '2026-01-09T00:00:00Z',
    documentNo: 'A-3',
    description: '<script>x</script> & uzunuzunuzunuzunuzunuzunuzunuzun',
    creditAccountType: 'receivable',
    creditAmount: 250,
  }),
];

describe('mobile PDF export', () => {
  it('produces an A4 landscape page', async () => {
    await exportPdf('Mijoz "A" & Co', TXS);
    expect(captured.width).toBe(842);
    expect(captured.height).toBe(595);
    expect(captured.margins).toEqual({ top: 28, right: 28, bottom: 28, left: 28 });
  });

  it('has consistent column arithmetic', () => {
    const html = captured.html as string;
    const bodyRows = [...html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((m) => m[1] ?? '');
    // 1 header row + 3 body rows + 1 footer row
    expect(bodyRows).toHaveLength(5);

    const cellCount = (row: string) =>
      [...row.matchAll(/<t[dh][\s>]/g)].length +
      [...row.matchAll(/colspan="(\d+)"/g)].reduce((s, m) => s + (Number(m[1]) - 1), 0);

    for (const row of bodyRows) expect(cellCount(row)).toBe(9);

    const widths = [...html.matchAll(/width:(\d+)%/g)].map((m) => Number(m[1]));
    expect(widths).toHaveLength(9);
    expect(widths.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('pairs each row with its own running balance, newest first', () => {
    const html = captured.html as string;
    const rows = [
      ...html.matchAll(/<tr>\s*<td class="nowrap">(\d{2}\.\d{2}\.\d{4})[\s\S]*?<\/tr>/g),
    ];
    const dates = rows.map((m) => m[1]);
    expect(dates).toEqual(['09.01.2026', '05.01.2026', '01.01.2026']);

    // Balances accumulate oldest-first. A credit on receivable is money we
    // owe them, so running goes -1000 -> -600 -> -850 and each row shows its
    // own figure with the "we owe" sign, newest at the top.
    const balances = rows.map((m) => {
      const cells = [...m[0].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => c[1] ?? '');
      return (cells[8] ?? '').replace(/\u00a0/g, ' ');
    });
    expect(balances).toEqual(['\u2212850', '\u2212600', '\u22121 000']);
  });

  it('totals the amount columns', () => {
    const html = captured.html as string;
    const foot = (html.match(/<tfoot>([\s\S]*?)<\/tfoot>/)?.[1] ?? '').replace(/\u00a0/g, ' ');
    expect(foot).toContain('>1 250<'); // chiqim 1000 + 250
    expect(foot).toContain('>400<'); // kirim
  });

  it('escapes user text and keeps print rules', () => {
    const html = captured.html as string;
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Mijoz &quot;A&quot; &amp; Co');
    expect(html).toContain('@page { size: A4 landscape; margin: 10mm; }');
    expect(html).toContain('display: table-header-group');
    expect(html).toContain('page-break-inside: avoid');
    expect(html).toContain('print-color-adjust: exact');
  });
});
