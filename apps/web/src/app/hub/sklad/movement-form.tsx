'use client';

import { useState } from 'react';
import {
  useSkladMovements,
  useRecordSkladMovement,
  useSkladOrders,
  useCounterparties,
} from '@mubosher/api-client';
import type { SkladBatchRow, SkladMovementKind } from '@mubosher/shared';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Input, Label, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

const KINDS: SkladMovementKind[] = ['chiqim', 'kirim', 'qaytarish', 'brak', 'korrektirovka'];

const KIND_TONE: Record<SkladMovementKind, 'neutral' | 'success' | 'danger' | 'warning' | 'brand'> =
  {
    kirim: 'success',
    chiqim: 'brand',
    qaytarish: 'warning',
    brak: 'danger',
    korrektirovka: 'neutral',
  };

const qtyFormat = new Intl.NumberFormat('ru-RU');
const kgFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 3 });

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Records what physically happened to a batch, and shows what has happened to
 * it so far.
 *
 * The remainder is no longer a field anyone types (0022) — shipping forty
 * pieces is recorded as shipping forty pieces, and the stock figure follows.
 * The database refuses a movement that would take the batch below zero and
 * says so in a message meant to be read, so it is surfaced verbatim.
 */
export function MovementForm({
  orgId,
  batch,
  onClose,
}: {
  orgId: string;
  batch: SkladBatchRow;
  onClose: () => void;
}) {
  const { t, locale } = useLocale();
  const dateLocale = locale === 'ru' ? 'ru-RU' : 'uz-UZ';
  const [supabase] = useState(() => createSupabaseBrowserClient());

  const { data: movements } = useSkladMovements(supabase, batch.id);
  const { data: orders } = useSkladOrders(supabase, orgId);
  const { data: counterparties } = useCounterparties(supabase, orgId);
  const record = useRecordSkladMovement(supabase);

  const [kind, setKind] = useState<SkladMovementKind>('chiqim');
  const [dona, setDona] = useState('');
  const [kg, setKg] = useState('');
  const [occurredAt, setOccurredAt] = useState(todayIso());
  const [counterpartyId, setCounterpartyId] = useState('');
  const [orderId, setOrderId] = useState(batch.orderId ?? '');
  const [note, setNote] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    try {
      await record.mutateAsync({
        orgId,
        batchId: batch.id,
        kind,
        dona: Number(dona),
        kg: kg ? Number(kg) : null,
        occurredAt,
        counterpartyId: counterpartyId || null,
        orderId: orderId || null,
        note: note || null,
      });
      setDona('');
      setKg('');
      setNote('');
    } catch (err) {
      setErrorMessage((err as Error).message);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-scrim/50 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-popover">
        <h2 className="text-base font-semibold text-slate-900">{t('sklad.movement.title')}</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          {batch.kod ? `${batch.kod} — ` : ''}
          {batch.itemName}
        </p>

        <div className="mt-3 flex flex-wrap gap-4 rounded-lg bg-slate-50 px-3 py-2 text-sm">
          <span className="text-slate-500">
            {t('sklad.batch.donaLabel')}:{' '}
            <span className="font-medium tabular-nums text-slate-900">
              {batch.donaSoni != null ? qtyFormat.format(batch.donaSoni) : '—'}
            </span>
          </span>
          <span className="text-slate-500">
            {t('sklad.batch.qoldiqLabel')}:{' '}
            <span className="font-semibold tabular-nums text-slate-900">
              {batch.qoldiqDona != null ? qtyFormat.format(batch.qoldiqDona) : '—'}
            </span>
          </span>
          <span className="text-slate-500">
            {t('sklad.totals.qoldiqKg')}:{' '}
            <span className="font-medium tabular-nums text-slate-900">
              {batch.qoldiqKg != null ? kgFormat.format(batch.qoldiqKg) : '—'}
            </span>
          </span>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <Label>{t('sklad.movement.kindLabel')}</Label>
              <Select value={kind} onChange={(e) => setKind(e.target.value as SkladMovementKind)}>
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {t(`sklad.movement.kind.${k}`)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>{t('sklad.movement.donaLabel')}</Label>
              <Input
                type="number"
                required
                value={dona}
                onChange={(e) => setDona(e.target.value)}
                placeholder={kind === 'korrektirovka' ? '±' : ''}
              />
            </div>
            <div>
              <Label>{t('sklad.movement.kgLabel')}</Label>
              <Input
                type="number"
                step="0.001"
                value={kg}
                onChange={(e) => setKg(e.target.value)}
              />
            </div>
            <div>
              <Label>{t('sklad.movement.dateLabel')}</Label>
              <Input
                type="date"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
              />
            </div>
            <div>
              <Label>{t('sklad.filters.customer')}</Label>
              <Select value={counterpartyId} onChange={(e) => setCounterpartyId(e.target.value)}>
                <option value="">—</option>
                {(counterparties ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>{t('sklad.filters.order')}</Label>
              <Select value={orderId} onChange={(e) => setOrderId(e.target.value)}>
                <option value="">—</option>
                {(orders ?? []).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.orderNo ?? o.orderName ?? t('sklad.order.untitled')}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <Label>{t('sklad.batch.notesLabel')}</Label>
            <Input type="text" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          {kind === 'korrektirovka' && (
            <p className="text-xs text-slate-500">{t('sklad.movement.korrektirovkaHint')}</p>
          )}

          {errorMessage && <p className="text-sm text-rose-600">{errorMessage}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={record.isPending || !dona}>
              {record.isPending ? t('common.saving') : t('sklad.movement.save')}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>
              {t('sklad.movement.close')}
            </Button>
          </div>
        </form>

        <div className="mt-5 border-t border-slate-200 pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t('sklad.movement.historyTitle')}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="py-1.5 pr-3 font-medium">{t('sklad.movement.dateLabel')}</th>
                  <th className="py-1.5 pr-3 font-medium">{t('sklad.movement.kindLabel')}</th>
                  <th className="py-1.5 pr-3 text-right font-medium">
                    {t('sklad.movement.donaLabel')}
                  </th>
                  <th className="py-1.5 pr-3 font-medium">{t('sklad.filters.customer')}</th>
                  <th className="py-1.5 font-medium">{t('audit.who')}</th>
                </tr>
              </thead>
              <tbody>
                {(movements ?? []).map((m) => (
                  <tr key={m.id} className="border-b border-slate-100">
                    <td className="py-1.5 pr-3 tabular-nums text-slate-600">
                      {new Date(m.occurredAt).toLocaleDateString(dateLocale)}
                    </td>
                    <td className="py-1.5 pr-3">
                      <Badge tone={KIND_TONE[m.kind]}>{t(`sklad.movement.kind.${m.kind}`)}</Badge>
                      {m.isInitial && (
                        <span className="ml-1.5 text-xs text-slate-400">
                          {t('sklad.movement.initial')}
                        </span>
                      )}
                    </td>
                    <td
                      className={`py-1.5 pr-3 text-right font-medium tabular-nums ${
                        m.dona < 0 ? 'text-rose-600' : 'text-emerald-700'
                      }`}
                    >
                      {m.dona > 0 ? '+' : ''}
                      {qtyFormat.format(m.dona)}
                    </td>
                    <td className="py-1.5 pr-3 text-slate-700">
                      {m.counterpartyName ?? m.note ?? '—'}
                    </td>
                    <td className="py-1.5 text-slate-500">{m.createdByName ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {movements?.length === 0 && (
              <p className="py-3 text-sm text-slate-500">{t('sklad.movement.historyEmpty')}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
