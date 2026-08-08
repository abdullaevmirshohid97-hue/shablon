'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  useSkladOrder,
  useUpdateSkladOrder,
  useSkladStages,
  useSkladOrderLines,
  useSaveSkladOrderLine,
  useDeleteSkladOrderLine,
  useSkladOrderDetail,
  useCounterparties,
} from '@mubosher/api-client';
import {
  indexStageCells,
  stageCellKey,
  sumStageOutput,
  summariseOrderProgress,
  type SkladLineProgress,
  type SkladOrderStatus,
} from '@mubosher/shared';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Card } from '@/components/ui/Card';
import { Input, Label, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { OrderQr } from './order-qr';
import { StageEntryForm } from './stage-entry-form';
import { ShipmentForm } from './shipment-form';

const ALL_STATUSES: SkladOrderStatus[] = [
  'yangi',
  'ishlab_chiqarishda',
  'tayyor',
  'yuklandi',
  'yopilgan',
];

const STATUS_TONE: Record<
  SkladOrderStatus,
  'neutral' | 'success' | 'danger' | 'warning' | 'brand'
> = {
  yangi: 'neutral',
  ishlab_chiqarishda: 'warning',
  tayyor: 'success',
  yuklandi: 'brand',
  yopilgan: 'neutral',
};

const qtyFormat = new Intl.NumberFormat('ru-RU');
const kgFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });

function lineLabel(line: SkladLineProgress): string {
  return (
    [line.artikul, line.itemName ?? line.description, line.sizeText, line.colorText]
      .filter(Boolean)
      .join(' · ') || '—'
  );
}

/**
 * The order every shop writes into.
 *
 * One document, one grid: rows down, stages across. A dyer and a cutter open
 * the same screen and see the same numbers — which is the whole point, and why
 * there is no per-department view here. A cell is empty until that shop has
 * reported, and an empty cell is the most useful thing on the page: it is the
 * work not yet done.
 */
export function OrderDetail({
  orgId,
  orderId,
  isOrgAdmin,
}: {
  orgId: string;
  orderId: string;
  isOrgAdmin: boolean;
}) {
  const { t, locale } = useLocale();
  const dateLocale = locale === 'ru' ? 'ru-RU' : 'uz-UZ';
  const [supabase] = useState(() => createSupabaseBrowserClient());

  const { data: order } = useSkladOrder(supabase, orderId);
  const { data: stages } = useSkladStages(supabase, orgId);
  const { data: lines } = useSkladOrderLines(supabase, orderId);
  const { data: detail } = useSkladOrderDetail(supabase, orgId, orderId);
  const { data: counterparties } = useCounterparties(supabase, orgId);
  const updateOrder = useUpdateSkladOrder(supabase);
  const saveLine = useSaveSkladOrderLine(supabase);
  const deleteLine = useDeleteSkladOrderLine(supabase);

  const [roster, setRoster] = useState<
    { user_id: string; full_name: string | null; email: string | null }[]
  >([]);
  const [editingCell, setEditingCell] = useState<{ lineId: string; stageId: string } | null>(null);
  const [shipmentOpen, setShipmentOpen] = useState(false);
  const [newLineOpen, setNewLineOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [lineDescription, setLineDescription] = useState('');
  const [lineSize, setLineSize] = useState('');
  const [lineColor, setLineColor] = useState('');
  const [linePlanned, setLinePlanned] = useState('');

  useEffect(() => {
    supabase.rpc('list_org_roster', { target_org_id: orgId }).then(({ data }) => {
      setRoster(data ?? []);
    });
  }, [supabase, orgId]);

  const progress = detail?.progress ?? [];

  /** Grid lookup by row and stage — one shared key helper so the writer and
   * the reader cannot drift apart. */
  const cellByKey = useMemo(() => indexStageCells(detail?.cells ?? []), [detail]);

  const totals = useMemo(() => summariseOrderProgress(progress), [progress]);

  /** Header fields save on change — this is a shared document several people
   * are looking at, and a Save button on it means one of them is looking at
   * yesterday. */
  async function patchOrder(patch: {
    counterpartyId?: string | null;
    managerId?: string | null;
    deadline?: string | null;
    status?: SkladOrderStatus;
  }) {
    setErrorMessage(null);
    try {
      await updateOrder.mutateAsync({
        orgId,
        orderId,
        orderNo: order?.orderNo ?? null,
        orderName: order?.orderName ?? null,
        counterpartyId: order?.counterpartyId ?? null,
        ...patch,
      });
    } catch (err) {
      setErrorMessage((err as Error).message);
    }
  }

  async function handleAddLine(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    try {
      await saveLine.mutateAsync({
        orgId,
        orderId,
        position: (lines?.length ?? 0) + 1,
        description: lineDescription || null,
        sizeText: lineSize || null,
        colorText: lineColor || null,
        plannedDona: linePlanned ? Number(linePlanned) : null,
      });
      setLineDescription('');
      setLineSize('');
      setLineColor('');
      setLinePlanned('');
      setNewLineOpen(false);
    } catch (err) {
      setErrorMessage((err as Error).message);
    }
  }

  const editingLine = editingCell ? progress.find((l) => l.lineId === editingCell.lineId) : null;
  const editingStage = editingCell ? stages?.find((s) => s.id === editingCell.stageId) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/hub/sklad/orders" className="text-sm text-slate-500 hover:text-brand-600">
            ← {t('sklad.nav.orders')}
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            {order?.orderNo ?? order?.orderName ?? t('sklad.order.untitled')}
          </h1>
          {order && (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <Badge tone={STATUS_TONE[order.status]}>
                {t(`sklad.orderStatus.${order.status}`)}
              </Badge>
              {order.orderName && <span>{order.orderName}</span>}
              {order.deadline && (
                <span>
                  {t('sklad.order.deadline')}:{' '}
                  {new Date(order.deadline).toLocaleDateString(dateLocale)}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-start gap-3">
          <Button type="button" onClick={() => setShipmentOpen(true)}>
            {t('sklad.shipment.action')}
          </Button>
          <OrderQr
            orderId={orderId}
            label={order?.orderNo ?? order?.orderName ?? t('sklad.order.untitled')}
          />
        </div>
      </div>

      {errorMessage && <p className="text-sm text-rose-600">{errorMessage}</p>}

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>{t('sklad.batch.customerLabel')}</Label>
            <Select
              value={order?.counterpartyId ?? ''}
              onChange={(e) => void patchOrder({ counterpartyId: e.target.value || null })}
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
            <Select
              value={order?.managerId ?? ''}
              onChange={(e) => void patchOrder({ managerId: e.target.value || null })}
            >
              <option value="">—</option>
              {roster.map((r) => (
                <option key={r.user_id} value={r.user_id}>
                  {r.full_name ?? r.email}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>{t('sklad.order.deadline')}</Label>
            <Input
              type="date"
              value={order?.deadline ?? ''}
              onChange={(e) => void patchOrder({ deadline: e.target.value || null })}
            />
          </div>
          <div>
            <Label>{t('sklad.order.statusLabel')}</Label>
            <Select
              value={order?.status ?? 'yangi'}
              onChange={(e) => void patchOrder({ status: e.target.value as SkladOrderStatus })}
            >
              {ALL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`sklad.orderStatus.${s}`)}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      {/* The grid: rows down, shops across. */}
      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900">{t('sklad.order.chainTitle')}</h2>
          <Button type="button" variant="secondary" size="sm" onClick={() => setNewLineOpen(true)}>
            {t('sklad.order.addLine')}
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-1.5 pr-3 font-medium">{t('sklad.order.line')}</th>
                <th className="py-1.5 pr-3 text-right font-medium">{t('sklad.order.planned')}</th>
                {(stages ?? []).map((s) => (
                  <th key={s.id} className="py-1.5 pr-3 text-right font-medium">
                    {s.name}
                  </th>
                ))}
                <th className="py-1.5 pr-3 text-right font-medium">{t('sklad.order.shipped')}</th>
                <th className="py-1.5 pr-3 text-right font-medium">{t('sklad.order.remaining')}</th>
                <th className="py-1.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {progress.map((line) => (
                <tr key={line.lineId} className="border-b border-slate-100">
                  <td className="py-1.5 pr-3">{lineLabel(line)}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-slate-500">
                    {line.plannedDona != null ? qtyFormat.format(line.plannedDona) : '—'}
                  </td>
                  {(stages ?? []).map((s) => {
                    const cell = cellByKey.get(stageCellKey(line.lineId, s.id));
                    const done = cell?.qtyOut ?? null;
                    return (
                      <td key={s.id} className="py-0.5 pr-3 text-right">
                        <button
                          type="button"
                          onClick={() => setEditingCell({ lineId: line.lineId, stageId: s.id })}
                          className={`w-full rounded-md px-2 py-1 text-right tabular-nums transition-colors ${
                            done
                              ? 'font-medium text-slate-900 hover:bg-brand-50'
                              : 'text-slate-300 hover:bg-slate-100'
                          }`}
                          title={
                            cell?.lastOccurredAt
                              ? new Date(cell.lastOccurredAt).toLocaleDateString(dateLocale)
                              : undefined
                          }
                        >
                          {done ? qtyFormat.format(done) : '+'}
                          {cell?.defectQty ? (
                            <span className="ml-1 text-xs text-rose-500">
                              −{qtyFormat.format(cell.defectQty)}
                            </span>
                          ) : null}
                        </button>
                      </td>
                    );
                  })}
                  <td className="py-1.5 pr-3 text-right tabular-nums">
                    {qtyFormat.format(line.shippedDona)}
                  </td>
                  <td className="py-1.5 pr-3 text-right font-semibold tabular-nums">
                    {qtyFormat.format(line.remainingDona)}
                  </td>
                  <td className="py-1.5 text-right">
                    {isOrgAdmin && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (!window.confirm(t('sklad.order.deleteLineConfirm'))) return;
                          void deleteLine.mutateAsync({ orderId, lineId: line.lineId });
                        }}
                      >
                        ×
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            {progress.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-300 font-semibold">
                  <td className="py-2 pr-3 text-xs uppercase text-slate-500">
                    {t('sklad.totals.label')}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {qtyFormat.format(totals.planned)}
                  </td>
                  {(stages ?? []).map((s) => {
                    const sum = sumStageOutput(detail?.cells ?? [], s.id);
                    return (
                      <td key={s.id} className="py-2 pr-3 text-right tabular-nums">
                        {sum ? qtyFormat.format(sum) : '—'}
                      </td>
                    );
                  })}
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {qtyFormat.format(totals.shipped)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {qtyFormat.format(totals.remaining)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>

          {progress.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-500">{t('sklad.order.noLines')}</p>
          )}
        </div>
      </Card>

      {/* Who has had how much of it. */}
      <Card className="p-4">
        <h2 className="mb-3 text-base font-semibold text-slate-900">
          {t('sklad.order.clientsTitle')}
        </h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-1.5 pr-3 font-medium">{t('sklad.batch.customerLabel')}</th>
              <th className="py-1.5 pr-3 text-right font-medium">{t('sklad.shipment.count')}</th>
              <th className="py-1.5 pr-3 text-right font-medium">{t('sklad.order.shipped')}</th>
              <th className="py-1.5 pr-3 text-right font-medium">{t('sklad.totals.qoldiqKg')}</th>
              <th className="py-1.5 font-medium">{t('sklad.shipment.lastDate')}</th>
            </tr>
          </thead>
          <tbody>
            {(detail?.clients ?? []).map((c) => (
              <tr key={c.counterpartyId ?? 'none'} className="border-b border-slate-100">
                <td className="py-1.5 pr-3">{c.counterpartyName}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums text-slate-500">
                  {c.shipmentCount}
                </td>
                <td className="py-1.5 pr-3 text-right font-medium tabular-nums">
                  {qtyFormat.format(c.shippedDona)}
                </td>
                <td className="py-1.5 pr-3 text-right tabular-nums">
                  {c.shippedKg ? kgFormat.format(c.shippedKg) : '—'}
                </td>
                <td className="py-1.5 tabular-nums text-slate-500">
                  {c.lastShippedAt ? new Date(c.lastShippedAt).toLocaleDateString(dateLocale) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {detail?.clients.length === 0 && (
          <p className="py-3 text-sm text-slate-500">{t('sklad.order.noShipments')}</p>
        )}
      </Card>

      {newLineOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-popover">
            <h2 className="mb-4 text-base font-semibold text-slate-900">
              {t('sklad.order.addLine')}
            </h2>
            <form onSubmit={handleAddLine} className="flex flex-col gap-3">
              <div>
                <Label>{t('sklad.item.nameLabel')}</Label>
                <Input
                  type="text"
                  required
                  value={lineDescription}
                  onChange={(e) => setLineDescription(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label>{t('sklad.item.sizeLabel')}</Label>
                  <Input
                    type="text"
                    value={lineSize}
                    onChange={(e) => setLineSize(e.target.value)}
                  />
                </div>
                <div>
                  <Label>{t('sklad.item.colorLabel')}</Label>
                  <Input
                    type="text"
                    value={lineColor}
                    onChange={(e) => setLineColor(e.target.value)}
                  />
                </div>
                <div>
                  <Label>{t('sklad.order.planned')}</Label>
                  <Input
                    type="number"
                    value={linePlanned}
                    onChange={(e) => setLinePlanned(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={saveLine.isPending}>
                  {t('common.save')}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setNewLineOpen(false)}>
                  {t('common.cancel')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingCell && editingStage && (
        <StageEntryForm
          orgId={orgId}
          orderId={orderId}
          lineId={editingCell.lineId}
          stageId={editingCell.stageId}
          stageName={editingStage.name}
          lineLabel={editingLine ? lineLabel(editingLine) : '—'}
          onClose={() => setEditingCell(null)}
        />
      )}

      {shipmentOpen && (
        <ShipmentForm
          orgId={orgId}
          orderId={orderId}
          lines={progress}
          defaultCounterpartyId={order?.counterpartyId}
          roster={roster}
          onClose={() => setShipmentOpen(false)}
        />
      )}
    </div>
  );
}
