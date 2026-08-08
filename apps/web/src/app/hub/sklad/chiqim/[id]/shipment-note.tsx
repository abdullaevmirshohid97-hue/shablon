'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useShipmentNote } from '@mubosher/api-client';
import { formatSize } from '@mubosher/shared';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Card } from '@/components/ui/Card';
import { DocumentCodes, PrintButton } from '../../document-codes';

const qtyFormat = new Intl.NumberFormat('ru-RU');
const kgFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });

/**
 * The despatch note — the copy that goes with the driver.
 *
 * It carries the same two codes as the invoice, for the same reason: the QR
 * opens this note from a phone, and the barcode pulls it up at a desk. Where
 * the despatch answered an invoice, the note prints the invoice's own barcode
 * as well, so a driver holding only the note can still be traced back to the
 * sale it fulfilled.
 */
export function ShipmentNote({ shipmentId }: { shipmentId: string }) {
  const { t, locale } = useLocale();
  const dateLocale = locale === 'ru' ? 'ru-RU' : 'uz-UZ';
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const { data: note, isLoading } = useShipmentNote(supabase, shipmentId);

  if (isLoading) {
    return <p className="py-6 text-sm text-slate-500">{t('common.loading')}</p>;
  }

  if (!note) {
    return <p className="py-6 text-sm text-slate-500">{t('sklad.chiqim.noteNotFound')}</p>;
  }

  const totalDona = note.lines.reduce((sum, l) => sum + l.dona, 0);
  const totalKg = note.lines.reduce((sum, l) => sum + (l.kg ?? 0), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link href="/hub/sklad/chiqim" className="text-sm text-slate-500 hover:text-brand-600">
          ← {t('sklad.nav.issuing')}
        </Link>
        <PrintButton label={t('sklad.chiqim.print')} />
      </div>

      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              {t('sklad.chiqim.noteTitle')}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {note.documentNo ? `${note.documentNo} · ` : ''}
              {new Date(note.shippedAt).toLocaleDateString(dateLocale)}
            </p>
            <p className="mt-3 text-base font-medium text-slate-900">
              {note.counterpartyName ?? '—'}
            </p>
            <div className="mt-1 flex flex-wrap gap-3 text-sm text-slate-500">
              {note.managerName && (
                <span>
                  {t('sklad.order.manager')}: {note.managerName}
                </span>
              )}
              {note.orderNo && (
                <span>
                  {t('sklad.batch.orderNoLabel')}: {note.orderNo}
                </span>
              )}
              {note.invoiceNo && (
                <span>
                  {t('sklad.faktura.number')}:{' '}
                  {note.invoiceId ? (
                    <Link
                      href={`/hub/sklad/faktura/${note.invoiceId}`}
                      className="text-brand-700 hover:underline"
                    >
                      {note.invoiceNo}
                    </Link>
                  ) : (
                    note.invoiceNo
                  )}
                </span>
              )}
            </div>
          </div>

          <DocumentCodes
            barcode={note.invoiceBarcode}
            path={`/hub/sklad/chiqim/${note.shipmentId}`}
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
                <th className="py-2 pr-3 text-right font-medium">{t('sklad.batch.donaLabel')}</th>
                <th className="py-2 text-right font-medium">{t('sklad.movement.kgLabel')}</th>
              </tr>
            </thead>
            <tbody>
              {note.lines.map((line, index) => (
                <tr key={line.lineId} className="border-b border-slate-100">
                  <td className="py-1.5 pr-3 text-slate-400">{index + 1}</td>
                  <td className="py-1.5 pr-3">{line.kod ?? '—'}</td>
                  <td className="py-1.5 pr-3">{line.itemName ?? '—'}</td>
                  <td className="py-1.5 pr-3 tabular-nums">
                    {formatSize(line.widthCm, line.lengthCm)}
                  </td>
                  <td className="py-1.5 pr-3">{line.colorName ?? '—'}</td>
                  <td className="py-1.5 pr-3 text-right font-medium tabular-nums">
                    {qtyFormat.format(line.dona)}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {line.kg != null ? kgFormat.format(Math.abs(line.kg)) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300 font-semibold">
                <td className="py-2 pr-3 text-xs uppercase text-slate-500" colSpan={5}>
                  {t('sklad.totals.label')}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">{qtyFormat.format(totalDona)}</td>
                <td className="py-2 text-right tabular-nums">{kgFormat.format(totalKg)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {note.note && <p className="mt-4 text-sm text-slate-500">{note.note}</p>}

        <div className="mt-10 flex justify-between gap-8 text-sm text-slate-500">
          <span>{t('sklad.chiqim.signedStore')} ______________________</span>
          <span>{t('sklad.chiqim.signedDriver')} ______________________</span>
        </div>
      </Card>
    </div>
  );
}
