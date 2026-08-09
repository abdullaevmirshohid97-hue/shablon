'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useInvoiceByCode } from '@mubosher/api-client';
import { formatSize, type SkladInvoiceStatus } from '@mubosher/shared';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { DocumentCodes, PrintButton } from '../../../document-codes';

const STATUS_TONE: Record<
  SkladInvoiceStatus,
  'neutral' | 'success' | 'danger' | 'warning' | 'brand'
> = {
  yangi: 'neutral',
  qisman: 'warning',
  bajarildi: 'success',
  bekor: 'danger',
};

const qtyFormat = new Intl.NumberFormat('ru-RU');
const moneyFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });

/**
 * The invoice as it prints.
 *
 * This is the sheet that travels: the manager prints it, and the storekeeper
 * scans the barcode on it to open the despatch screen already filled in. The
 * page chrome is hidden by `no-print`, so what comes out of the printer is the
 * document and its two codes and nothing else.
 *
 * It is fetched through the same lookup the scanner uses, by id — one code
 * path for both, so the sheet on the desk and the screen at the bay can never
 * disagree about what is outstanding.
 */
export function FakturaDocument({ orgId, invoiceId }: { orgId: string; invoiceId: string }) {
  const { t, locale } = useLocale();
  const dateLocale = locale === 'ru' ? 'ru-RU' : 'uz-UZ';
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const { data: invoice, isLoading } = useInvoiceByCode(supabase, orgId, invoiceId);

  if (isLoading) {
    return <p className="py-6 text-sm text-slate-500">{t('common.loading')}</p>;
  }

  if (!invoice) {
    return <p className="py-6 text-sm text-slate-500">{t('sklad.faktura.notFound')}</p>;
  }

  const total = invoice.lines.reduce((sum, l) => sum + (l.amount ?? 0), 0);
  const ordered = invoice.lines.reduce((sum, l) => sum + l.orderedDona, 0);
  const shipped = invoice.lines.reduce((sum, l) => sum + l.shippedDona, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link href="/hub/sotuv/faktura" className="text-sm text-slate-500 hover:text-brand-600">
          ← {t('sklad.faktura.title')}
        </Link>
        <PrintButton label={t('sklad.faktura.print')} />
      </div>

      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              {invoice.invoiceNo ?? '—'}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {new Date(invoice.issuedAt).toLocaleDateString(dateLocale)}
            </p>
            <p className="mt-3 text-base font-medium text-slate-900">{invoice.counterpartyName}</p>
            {invoice.note && <p className="mt-1 text-sm text-slate-500">{invoice.note}</p>}
            <Badge tone={STATUS_TONE[invoice.status]} className="mt-3">
              {t(`sklad.invoiceStatus.${invoice.status}`)}
            </Badge>
          </div>

          <DocumentCodes
            barcode={invoice.barcode}
            path={`/hub/sotuv/faktura/${invoice.invoiceId}`}
          />
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-300 text-left text-xs text-slate-500">
                <th className="py-2 pr-3 font-medium">№</th>
                <th className="py-2 pr-3 font-medium">{t('sklad.item.kodLabel')}</th>
                <th className="py-2 pr-3 font-medium">{t('sklad.item.nameLabel')}</th>
                <th className="py-2 pr-3 font-medium">{t('sklad.item.sizeLabel')}</th>
                <th className="py-2 pr-3 font-medium">{t('sklad.item.colorLabel')}</th>
                <th className="py-2 pr-3 text-right font-medium">{t('sklad.faktura.qty')}</th>
                <th className="py-2 pr-3 text-right font-medium">{t('sklad.order.shipped')}</th>
                <th className="py-2 pr-3 text-right font-medium">{t('sklad.order.remaining')}</th>
                <th className="py-2 pr-3 text-right font-medium">{t('sklad.faktura.unitPrice')}</th>
                <th className="py-2 text-right font-medium">{t('sklad.price.totalAmountLabel')}</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines.map((line, index) => (
                <tr key={line.lineId} className="border-b border-slate-100">
                  <td className="py-1.5 pr-3 text-slate-400">{index + 1}</td>
                  <td className="py-1.5 pr-3">{line.kod ?? '—'}</td>
                  <td className="py-1.5 pr-3">{line.itemName ?? '—'}</td>
                  <td className="py-1.5 pr-3 tabular-nums">
                    {formatSize(line.widthCm, line.lengthCm)}
                  </td>
                  <td className="py-1.5 pr-3">{line.colorName ?? '—'}</td>
                  <td className="py-1.5 pr-3 text-right font-medium tabular-nums">
                    {qtyFormat.format(line.orderedDona)}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-slate-500">
                    {qtyFormat.format(line.shippedDona)}
                  </td>
                  <td className="py-1.5 pr-3 text-right font-semibold tabular-nums">
                    {qtyFormat.format(line.remainingDona)}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">
                    {line.unitPrice != null ? moneyFormat.format(line.unitPrice) : '—'}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {line.amount != null ? moneyFormat.format(line.amount) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300 font-semibold">
                <td className="py-2 pr-3 text-xs uppercase text-slate-500" colSpan={5}>
                  {t('sklad.totals.label')}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">{qtyFormat.format(ordered)}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{qtyFormat.format(shipped)}</td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {qtyFormat.format(ordered - shipped)}
                </td>
                <td />
                <td className="py-2 text-right tabular-nums">
                  {moneyFormat.format(total)} {invoice.currency}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="mt-10 flex justify-between gap-8 text-sm text-slate-500">
          <span>{t('sklad.faktura.signedManager')} ______________________</span>
          <span>{t('sklad.faktura.signedClient')} ______________________</span>
        </div>
      </Card>
    </div>
  );
}
