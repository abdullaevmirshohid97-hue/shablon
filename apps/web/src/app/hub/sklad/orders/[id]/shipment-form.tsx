'use client';

import { useMemo, useState } from 'react';
import { useCreateShipment, useCounterparties } from '@mubosher/api-client';
import type { SkladLineProgress } from '@mubosher/shared';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Input, Label, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

const qtyFormat = new Intl.NumberFormat('ru-RU');

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function lineLabel(line: SkladLineProgress): string {
  return (
    [line.artikul, line.itemName ?? line.description, line.sizeText, line.colorText]
      .filter(Boolean)
      .join(' · ') || '—'
  );
}

/**
 * The loading bay: what is going out, to which client, through which manager.
 *
 * The client sits on the despatch rather than on the order because one order
 * is routinely split across several — which is exactly the question this
 * screen exists to answer, row by row: how much has gone, how much is left.
 *
 * Quantities are capped at what is still owed. Over-shipping a row is almost
 * always a typo, and the alternative is a remainder that goes negative and
 * quietly poisons every total downstream of it.
 */
export function ShipmentForm({
  orgId,
  orderId,
  lines,
  defaultCounterpartyId,
  roster,
  onClose,
}: {
  orgId: string;
  orderId: string;
  lines: SkladLineProgress[];
  defaultCounterpartyId?: string | null;
  roster: { user_id: string; full_name: string | null; email: string | null }[];
  onClose: () => void;
}) {
  const { t } = useLocale();
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const { data: counterparties } = useCounterparties(supabase, orgId);
  const createShipment = useCreateShipment(supabase);

  const [counterpartyId, setCounterpartyId] = useState(defaultCounterpartyId ?? '');
  const [managerId, setManagerId] = useState('');
  const [documentNo, setDocumentNo] = useState('');
  const [shippedAt, setShippedAt] = useState(todayIso());
  const [note, setNote] = useState('');
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const total = useMemo(
    () => Object.values(quantities).reduce((sum, v) => sum + (Number(v) || 0), 0),
    [quantities],
  );

  function setQty(lineId: string, value: string, remaining: number) {
    const capped = Math.min(Math.max(Number(value) || 0, 0), remaining);
    setQuantities((q) => ({ ...q, [lineId]: value === '' ? '' : String(capped) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    const shipmentLines = lines
      .map((l) => ({ orderLineId: l.lineId, dona: Number(quantities[l.lineId] ?? 0) || 0 }))
      .filter((l) => l.dona > 0);

    if (!shipmentLines.length) {
      setErrorMessage(t('sklad.shipment.nothingSelected'));
      return;
    }

    try {
      await createShipment.mutateAsync({
        orgId,
        orderId,
        counterpartyId: counterpartyId || null,
        managerId: managerId || null,
        documentNo: documentNo || null,
        shippedAt,
        note: note || null,
        lines: shipmentLines,
      });
      onClose();
    } catch (err) {
      setErrorMessage((err as Error).message);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-5 shadow-popover">
        <h2 className="mb-4 text-base font-semibold text-slate-900">{t('sklad.shipment.title')}</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <Label>{t('sklad.batch.customerLabel')}</Label>
              <Select
                value={counterpartyId}
                onChange={(e) => setCounterpartyId(e.target.value)}
                required
              >
                <option value="">—</option>
                {(counterparties ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>{t('sklad.order.manager')}</Label>
              <Select value={managerId} onChange={(e) => setManagerId(e.target.value)}>
                <option value="">—</option>
                {roster.map((r) => (
                  <option key={r.user_id} value={r.user_id}>
                    {r.full_name ?? r.email}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>{t('sklad.shipment.documentNo')}</Label>
              <Input
                type="text"
                value={documentNo}
                onChange={(e) => setDocumentNo(e.target.value)}
              />
            </div>
            <div>
              <Label>{t('sklad.shipment.date')}</Label>
              <Input type="date" value={shippedAt} onChange={(e) => setShippedAt(e.target.value)} />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="py-1.5 pr-3 font-medium">{t('sklad.order.line')}</th>
                  <th className="py-1.5 pr-3 text-right font-medium">{t('sklad.order.planned')}</th>
                  <th className="py-1.5 pr-3 text-right font-medium">{t('sklad.order.ready')}</th>
                  <th className="py-1.5 pr-3 text-right font-medium">{t('sklad.order.shipped')}</th>
                  <th className="py-1.5 pr-3 text-right font-medium">
                    {t('sklad.order.remaining')}
                  </th>
                  <th className="py-1.5 text-right font-medium">
                    {t('sklad.shipment.nowShipping')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.lineId} className="border-b border-slate-100">
                    <td className="py-1.5 pr-3">{lineLabel(l)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums text-slate-500">
                      {l.plannedDona != null ? qtyFormat.format(l.plannedDona) : '—'}
                    </td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">
                      {qtyFormat.format(l.readyDona)}
                    </td>
                    <td className="py-1.5 pr-3 text-right tabular-nums text-slate-500">
                      {qtyFormat.format(l.shippedDona)}
                    </td>
                    <td className="py-1.5 pr-3 text-right font-medium tabular-nums">
                      {qtyFormat.format(l.remainingDona)}
                    </td>
                    <td className="py-1.5 text-right">
                      <Input
                        type="number"
                        min={0}
                        max={l.remainingDona}
                        value={quantities[l.lineId] ?? ''}
                        onChange={(e) => setQty(l.lineId, e.target.value, l.remainingDona)}
                        className="w-24 text-right tabular-nums"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 font-semibold">
                  <td className="py-2 pr-3 text-xs uppercase text-slate-500" colSpan={5}>
                    {t('sklad.totals.label')}
                  </td>
                  <td className="py-2 text-right tabular-nums">{qtyFormat.format(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div>
            <Label>{t('sklad.batch.notesLabel')}</Label>
            <Input type="text" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          {errorMessage && <p className="text-sm text-rose-600">{errorMessage}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={createShipment.isPending || total <= 0}>
              {createShipment.isPending ? t('common.saving') : t('sklad.shipment.save')}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>
              {t('common.cancel')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
