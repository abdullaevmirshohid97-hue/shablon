'use client';

import { useState } from 'react';
import { useSkladStageEntries, useRecordStageEntry } from '@mubosher/api-client';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Input, Label } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

const qtyFormat = new Intl.NumberFormat('ru-RU');

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * One shop reporting on one row of the order.
 *
 * Entries accumulate rather than replace: a dye house that does four hundred
 * today and six hundred tomorrow records two entries, and the cell on the grid
 * shows a thousand. Overwriting would lose the first day, and with it any
 * chance of asking how long the stage actually took.
 */
export function StageEntryForm({
  orgId,
  orderId,
  lineId,
  stageId,
  stageName,
  lineLabel,
  onClose,
}: {
  orgId: string;
  orderId: string;
  lineId: string;
  stageId: string;
  stageName: string;
  lineLabel: string;
  onClose: () => void;
}) {
  const { t, locale } = useLocale();
  const dateLocale = locale === 'ru' ? 'ru-RU' : 'uz-UZ';
  const [supabase] = useState(() => createSupabaseBrowserClient());

  const { data: entries } = useSkladStageEntries(supabase, lineId, stageId);
  const record = useRecordStageEntry(supabase);

  const [qtyIn, setQtyIn] = useState('');
  const [qtyOut, setQtyOut] = useState('');
  const [defectQty, setDefectQty] = useState('');
  const [kg, setKg] = useState('');
  const [executorName, setExecutorName] = useState('');
  const [occurredAt, setOccurredAt] = useState(todayIso());
  const [note, setNote] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    try {
      await record.mutateAsync({
        orgId,
        orderId,
        lineId,
        stageId,
        qtyIn: qtyIn ? Number(qtyIn) : null,
        qtyOut: qtyOut ? Number(qtyOut) : null,
        defectQty: defectQty ? Number(defectQty) : null,
        kg: kg ? Number(kg) : null,
        executorName: executorName || null,
        occurredAt,
        note: note || null,
      });
      setQtyIn('');
      setQtyOut('');
      setDefectQty('');
      setKg('');
      setNote('');
    } catch (err) {
      setErrorMessage((err as Error).message);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-5 shadow-popover">
        <h2 className="text-base font-semibold text-slate-900">{stageName}</h2>
        <p className="mt-0.5 text-sm text-slate-500">{lineLabel}</p>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <Label>{t('sklad.stage.qtyIn')}</Label>
              <Input type="number" value={qtyIn} onChange={(e) => setQtyIn(e.target.value)} />
            </div>
            <div>
              <Label>{t('sklad.stage.qtyOut')}</Label>
              <Input
                type="number"
                required
                value={qtyOut}
                onChange={(e) => setQtyOut(e.target.value)}
              />
            </div>
            <div>
              <Label>{t('sklad.batch.defectQtyLabel')}</Label>
              <Input
                type="number"
                value={defectQty}
                onChange={(e) => setDefectQty(e.target.value)}
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
            <div className="col-span-2">
              <Label>{t('sklad.stage.executor')}</Label>
              <Input
                type="text"
                value={executorName}
                onChange={(e) => setExecutorName(e.target.value)}
                placeholder={t('sklad.stage.executorHint')}
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
              <Label>{t('sklad.batch.notesLabel')}</Label>
              <Input type="text" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>

          {errorMessage && <p className="text-sm text-rose-600">{errorMessage}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={record.isPending || !qtyOut}>
              {record.isPending ? t('common.saving') : t('sklad.stage.save')}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>
              {t('sklad.movement.close')}
            </Button>
          </div>
        </form>

        <div className="mt-5 border-t border-slate-200 pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t('sklad.stage.historyTitle')}
          </p>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-1.5 pr-3 font-medium">{t('sklad.movement.dateLabel')}</th>
                <th className="py-1.5 pr-3 text-right font-medium">{t('sklad.stage.qtyOut')}</th>
                <th className="py-1.5 pr-3 text-right font-medium">
                  {t('sklad.batch.defectQtyLabel')}
                </th>
                <th className="py-1.5 pr-3 font-medium">{t('sklad.stage.executor')}</th>
                <th className="py-1.5 font-medium">{t('audit.who')}</th>
              </tr>
            </thead>
            <tbody>
              {(entries ?? []).map((e) => (
                <tr key={e.id} className="border-b border-slate-100">
                  <td className="py-1.5 pr-3 tabular-nums text-slate-600">
                    {new Date(e.occurredAt).toLocaleDateString(dateLocale)}
                  </td>
                  <td className="py-1.5 pr-3 text-right font-medium tabular-nums text-emerald-700">
                    {e.qtyOut != null ? qtyFormat.format(e.qtyOut) : '—'}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-rose-600">
                    {e.defectQty ? qtyFormat.format(e.defectQty) : '—'}
                  </td>
                  <td className="py-1.5 pr-3 text-slate-700">{e.executorName ?? '—'}</td>
                  <td className="py-1.5 text-slate-500">{e.createdByName ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {entries?.length === 0 && (
            <p className="py-3 text-sm text-slate-500">{t('sklad.stage.historyEmpty')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
