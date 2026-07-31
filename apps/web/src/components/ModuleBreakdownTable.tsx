'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import type { ModuleRow as ReportModuleRow } from '@mubosher/api-client';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

const currencyFormatter = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 0 });

interface ModuleRow {
  name: string;
  clientCount: number;
  kirim: number;
  chiqim: number;
  qarz: number;
}

export function ModuleBreakdownTable({ modules }: { modules: ReportModuleRow[] }) {
  const { t } = useLocale();

  // Aggregated by org_module_breakdown(); nothing is recomputed here.
  const rows = useMemo<ModuleRow[]>(
    () =>
      modules.map((m) => ({
        name: m.moduleName,
        clientCount: m.counterpartyCount,
        kirim: m.totalKirim,
        chiqim: m.totalChiqim,
        qarz: Math.max(m.balance, 0),
      })),
    [modules],
  );

  if (!rows.length) return null;

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-base font-semibold text-slate-900">{t('overview.byModule')}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-50">
            <tr className="border-b border-slate-200 text-left">
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {t('overview.module')}
              </th>
              <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {t('overview.clientCount')}
              </th>
              <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {t('ledger.kirim')}
              </th>
              <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {t('ledger.chiqim')}
              </th>
              <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {t('ledger.qarz')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.name}
                className="border-b border-slate-100 last:border-0 even:bg-slate-50/60"
              >
                <td className="px-4 py-2.5">
                  <Link
                    href={`/dashboard/${encodeURIComponent(row.name)}`}
                    className="font-medium text-slate-900 hover:text-brand-700"
                  >
                    {row.name}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">
                  {row.clientCount}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-emerald-600">
                  {currencyFormatter.format(row.kirim)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-rose-600">
                  {currencyFormatter.format(row.chiqim)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {row.qarz > 0 ? (
                    <Badge tone="success">{currencyFormatter.format(row.qarz)}</Badge>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
