'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  useSkladOrderSummary,
  useSkladStageLoad,
  useSkladStock,
  useCounterparties,
} from '@mubosher/api-client';
import { completionPercent, type SkladOrderStatus } from '@mubosher/shared';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Card } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';

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
const kgFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });

/** A progress bar drawn from two numbers, no chart library involved. */
function Progress({ value, total }: { value: number; total: number }) {
  const pct = completionPercent(value, total);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-9 text-right text-xs tabular-nums text-slate-500">{pct}%</span>
    </div>
  );
}

/**
 * Warehouse and production analytics on one screen.
 *
 * Three questions, in the order they get asked: where is every order, how much
 * has each shop put through lately, and what is sitting on the shelves.
 */
export function OverviewView({ orgId, isOrgAdmin }: { orgId: string; isOrgAdmin: boolean }) {
  const { t, locale } = useLocale();
  const dateLocale = locale === 'ru' ? 'ru-RU' : 'uz-UZ';
  const [supabase] = useState(() => createSupabaseBrowserClient());

  const [status, setStatus] = useState<SkladOrderStatus | ''>('');
  const [counterpartyId, setCounterpartyId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const { data: orders } = useSkladOrderSummary(supabase, orgId, { status, counterpartyId });
  const { data: stageLoad } = useSkladStageLoad(supabase, orgId, { from, to });
  const { data: stock } = useSkladStock(supabase, orgId);
  const { data: counterparties } = useCounterparties(supabase, orgId);

  const totals = useMemo(() => {
    return (orders ?? []).reduce(
      (acc, o) => ({
        planned: acc.planned + o.plannedDona,
        ready: acc.ready + o.readyDona,
        shipped: acc.shipped + o.shippedDona,
        remaining: acc.remaining + o.remainingDona,
      }),
      { planned: 0, ready: 0, shipped: 0, remaining: 0 },
    );
  }, [orders]);

  const stockTotals = useMemo(() => {
    return (stock ?? []).reduce(
      (acc, s) => ({
        dona: acc.dona + s.totalDona,
        kg: acc.kg + s.totalKg,
        value: acc.value + (s.stockValue ?? 0),
      }),
      { dona: 0, kg: 0, value: 0 },
    );
  }, [stock]);

  const maxStageOut = useMemo(
    () => Math.max(1, ...(stageLoad ?? []).map((s) => s.qtyOut)),
    [stageLoad],
  );

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
        {t('sklad.nav.overview')}
      </h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: t('sklad.order.planned'), value: qtyFormat.format(totals.planned) },
          { label: t('sklad.order.ready'), value: qtyFormat.format(totals.ready) },
          { label: t('sklad.order.shipped'), value: qtyFormat.format(totals.shipped) },
          { label: t('sklad.order.remaining'), value: qtyFormat.format(totals.remaining) },
        ].map((tile) => (
          <Card key={tile.label} className="p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">{tile.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{tile.value}</p>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900">{t('sklad.analytics.orders')}</h2>
          <div className="flex flex-wrap gap-2">
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value as SkladOrderStatus | '')}
            >
              <option value="">{t('sklad.order.statusLabel')}</option>
              {ALL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`sklad.orderStatus.${s}`)}
                </option>
              ))}
            </Select>
            <Select value={counterpartyId} onChange={(e) => setCounterpartyId(e.target.value)}>
              <option value="">{t('sklad.filters.customer')}</option>
              {(counterparties ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-1.5 pr-3 font-medium">{t('sklad.batch.orderNoLabel')}</th>
                <th className="py-1.5 pr-3 font-medium">{t('sklad.batch.customerLabel')}</th>
                <th className="py-1.5 pr-3 font-medium">{t('sklad.order.manager')}</th>
                <th className="py-1.5 pr-3 font-medium">{t('sklad.order.currentStage')}</th>
                <th className="py-1.5 pr-3 text-right font-medium">{t('sklad.order.planned')}</th>
                <th className="py-1.5 pr-3 text-right font-medium">{t('sklad.order.ready')}</th>
                <th className="py-1.5 pr-3 text-right font-medium">{t('sklad.order.shipped')}</th>
                <th className="py-1.5 pr-3 text-right font-medium">{t('sklad.order.remaining')}</th>
                <th className="py-1.5 pr-3 font-medium">{t('sklad.analytics.progress')}</th>
                <th className="py-1.5 font-medium">{t('sklad.order.deadline')}</th>
              </tr>
            </thead>
            <tbody>
              {(orders ?? []).map((o) => (
                <tr key={o.orderId} className="border-b border-slate-100">
                  <td className="py-1.5 pr-3">
                    <Link
                      href={`/hub/sklad/orders/${o.orderId}`}
                      className="font-medium text-brand-700 hover:underline"
                    >
                      {o.orderNo ?? o.orderName ?? t('sklad.order.untitled')}
                    </Link>
                    <Badge tone={STATUS_TONE[o.status]} className="ml-1.5">
                      {t(`sklad.orderStatus.${o.status}`)}
                    </Badge>
                  </td>
                  <td className="py-1.5 pr-3">{o.counterpartyName ?? '—'}</td>
                  <td className="py-1.5 pr-3 text-slate-600">{o.managerName ?? '—'}</td>
                  <td className="py-1.5 pr-3 text-slate-600">{o.currentStage ?? '—'}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-slate-500">
                    {qtyFormat.format(o.plannedDona)}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">
                    {qtyFormat.format(o.readyDona)}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">
                    {qtyFormat.format(o.shippedDona)}
                  </td>
                  <td className="py-1.5 pr-3 text-right font-semibold tabular-nums">
                    {qtyFormat.format(o.remainingDona)}
                  </td>
                  <td className="py-1.5 pr-3">
                    <Progress value={o.shippedDona} total={o.plannedDona} />
                  </td>
                  <td className="py-1.5 tabular-nums text-slate-500">
                    {o.deadline ? new Date(o.deadline).toLocaleDateString(dateLocale) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders?.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-500">{t('sklad.order.empty')}</p>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900">
              {t('sklad.analytics.stageLoad')}
            </h2>
            <div className="flex gap-2">
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {(stageLoad ?? []).map((s) => (
              <div key={s.stageId} className="flex items-center gap-3">
                <span className="w-40 shrink-0 truncate text-sm text-slate-700">{s.stageName}</span>
                <div className="h-5 flex-1 overflow-hidden rounded bg-slate-100">
                  <div
                    className="h-full rounded bg-brand-500"
                    style={{ width: `${Math.round((s.qtyOut / maxStageOut) * 100)}%` }}
                  />
                </div>
                <span className="w-20 text-right text-sm tabular-nums text-slate-900">
                  {qtyFormat.format(s.qtyOut)}
                </span>
                <span className="w-16 text-right text-xs tabular-nums text-rose-600">
                  {s.defectQty ? `−${qtyFormat.format(s.defectQty)}` : ''}
                </span>
              </div>
            ))}
            {stageLoad?.length === 0 && (
              <p className="py-3 text-sm text-slate-500">{t('sklad.analytics.noStages')}</p>
            )}
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 text-base font-semibold text-slate-900">
            {t('sklad.analytics.stock')}
          </h2>
          <div className="mb-3 flex flex-wrap gap-4 text-sm">
            <span className="text-slate-500">
              {t('sklad.stock.dona')}:{' '}
              <span className="font-semibold tabular-nums text-slate-900">
                {qtyFormat.format(stockTotals.dona)}
              </span>
            </span>
            <span className="text-slate-500">
              {t('sklad.stock.kg')}:{' '}
              <span className="font-semibold tabular-nums text-slate-900">
                {kgFormat.format(stockTotals.kg)}
              </span>
            </span>
            {isOrgAdmin && stockTotals.value > 0 && (
              <span className="text-slate-500">
                {t('sklad.stock.value')}:{' '}
                <span className="font-semibold tabular-nums text-slate-900">
                  {qtyFormat.format(Math.round(stockTotals.value))}
                </span>
              </span>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="py-1.5 pr-3 font-medium">{t('sklad.item.nameLabel')}</th>
                  <th className="py-1.5 pr-3 text-right font-medium">{t('sklad.stock.dona')}</th>
                  <th className="py-1.5 text-right font-medium">{t('sklad.stock.kg')}</th>
                </tr>
              </thead>
              <tbody>
                {(stock ?? []).map((s) => (
                  <tr key={s.itemId} className="border-b border-slate-100">
                    <td className="py-1.5 pr-3">
                      {s.kod ? `${s.kod} — ` : ''}
                      {s.itemName}
                    </td>
                    <td className="py-1.5 pr-3 text-right font-medium tabular-nums">
                      {qtyFormat.format(s.totalDona)}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{kgFormat.format(s.totalKg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {stock?.length === 0 && (
              <p className="py-3 text-sm text-slate-500">{t('sklad.empty')}</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
