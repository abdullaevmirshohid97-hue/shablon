'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  useSkladBatches,
  useSkladItems,
  useSkladLookups,
  useSkladOrders,
  useCounterparties,
} from '@mubosher/api-client';
import type { SkladBatch, SkladBatchStatus } from '@mubosher/shared';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Card } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ItemForm } from './item-form';
import { BatchForm } from './batch-form';

const ALL_STATUSES: SkladBatchStatus[] = [
  'tayyor',
  'qadoqlanmoqda',
  'omborda',
  'rezerv',
  'jonatildi',
  'qaytarildi',
  'brak',
];

const STATUS_TONE: Record<
  SkladBatchStatus,
  'neutral' | 'success' | 'danger' | 'warning' | 'brand'
> = {
  tayyor: 'success',
  qadoqlanmoqda: 'warning',
  omborda: 'neutral',
  rezerv: 'warning',
  jonatildi: 'brand',
  qaytarildi: 'danger',
  brak: 'danger',
};

export function SkladList({ orgId, isOrgAdmin }: { orgId: string; isOrgAdmin: boolean }) {
  const { t, locale } = useLocale();
  const dateLocale = locale === 'ru' ? 'ru-RU' : 'uz-UZ';
  const [supabase] = useState(() => createSupabaseBrowserClient());

  const { data: batches } = useSkladBatches(supabase, orgId);
  const { data: items } = useSkladItems(supabase, orgId);
  const { data: orders } = useSkladOrders(supabase, orgId);
  const { data: lookups } = useSkladLookups(supabase, orgId);
  const { data: counterparties } = useCounterparties(supabase, orgId);

  const [search, setSearch] = useState('');
  const [productTypeFilter, setProductTypeFilter] = useState('');
  const [colorFilter, setColorFilter] = useState('');
  const [pantoneFilter, setPantoneFilter] = useState('');
  const [gsmFilter, setGsmFilter] = useState('');
  const [sizeFilter, setSizeFilter] = useState('');
  const [sortFilter, setSortFilter] = useState('');
  const [orderFilter, setOrderFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<SkladBatch | null>(null);

  const itemById = useMemo(() => new Map((items ?? []).map((i) => [i.id, i])), [items]);
  const orderById = useMemo(() => new Map((orders ?? []).map((o) => [o.id, o])), [orders]);
  const lookupsByKind = useMemo(() => {
    const map = new Map<string, typeof lookups>();
    for (const l of lookups ?? []) {
      const list = map.get(l.kind) ?? [];
      list.push(l);
      map.set(l.kind, list);
    }
    return map;
  }, [lookups]);

  const gsmOptions = useMemo(() => {
    const set = new Set<number>();
    for (const i of items ?? []) if (i.gsm != null) set.add(i.gsm);
    return Array.from(set).sort((a, b) => a - b);
  }, [items]);

  const filteredBatches = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (batches ?? []).filter((b) => {
      const item = itemById.get(b.itemId);
      const order = b.orderId ? orderById.get(b.orderId) : undefined;

      if (productTypeFilter && item?.productTypeId !== productTypeFilter) return false;
      if (colorFilter && item?.colorId !== colorFilter) return false;
      if (pantoneFilter && item?.pantoneId !== pantoneFilter) return false;
      if (gsmFilter && String(item?.gsm ?? '') !== gsmFilter) return false;
      if (sizeFilter && item?.sizeId !== sizeFilter) return false;
      if (sortFilter && item?.sortId !== sortFilter) return false;
      if (orderFilter && b.orderId !== orderFilter) return false;
      if (customerFilter && order?.counterpartyId !== customerFilter) return false;
      if (statusFilter && b.status !== statusFilter) return false;
      if (dateFrom && b.omborgaKirganSana < dateFrom) return false;
      if (dateTo && b.omborgaKirganSana > dateTo) return false;
      if (q) {
        const haystack = `${b.itemArtikul ?? ''} ${b.itemName ?? ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [
    batches,
    itemById,
    orderById,
    search,
    productTypeFilter,
    colorFilter,
    pantoneFilter,
    gsmFilter,
    sizeFilter,
    sortFilter,
    orderFilter,
    customerFilter,
    statusFilter,
    dateFrom,
    dateTo,
  ]);

  function lookupName(id: string | null | undefined): string {
    if (!id) return '—';
    return lookups?.find((l) => l.id === id)?.name ?? '—';
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{t('sklad.title')}</h1>
        <div className="flex items-center gap-2">
          {isOrgAdmin && (
            <Link
              href="/hub/sklad/settings"
              className="text-sm text-slate-500 hover:text-brand-600"
            >
              {t('sklad.settingsLink')}
            </Link>
          )}
          <Button type="button" variant="secondary" onClick={() => setItemModalOpen(true)}>
            {t('sklad.addItem')}
          </Button>
          <Button
            type="button"
            onClick={() => {
              setEditingBatch(null);
              setBatchModalOpen(true);
            }}
          >
            {t('sklad.addBatch')}
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('sklad.searchPlaceholder')}
            className="lg:col-span-2"
          />
          <Select value={productTypeFilter} onChange={(e) => setProductTypeFilter(e.target.value)}>
            <option value="">{t('sklad.filters.productType')}</option>
            {(lookupsByKind.get('mahsulot_turi') ?? []).map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
          <Select value={colorFilter} onChange={(e) => setColorFilter(e.target.value)}>
            <option value="">{t('sklad.filters.color')}</option>
            {(lookupsByKind.get('rang') ?? []).map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
          <Select value={pantoneFilter} onChange={(e) => setPantoneFilter(e.target.value)}>
            <option value="">{t('sklad.filters.pantone')}</option>
            {(lookupsByKind.get('pantone') ?? []).map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
          <Select value={gsmFilter} onChange={(e) => setGsmFilter(e.target.value)}>
            <option value="">{t('sklad.filters.gsm')}</option>
            {gsmOptions.map((g) => (
              <option key={g} value={String(g)}>
                {g}
              </option>
            ))}
          </Select>
          <Select value={sizeFilter} onChange={(e) => setSizeFilter(e.target.value)}>
            <option value="">{t('sklad.filters.size')}</option>
            {(lookupsByKind.get('olcham') ?? []).map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
          <Select value={sortFilter} onChange={(e) => setSortFilter(e.target.value)}>
            <option value="">{t('sklad.filters.sort')}</option>
            {(lookupsByKind.get('sort') ?? []).map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
          <Select value={orderFilter} onChange={(e) => setOrderFilter(e.target.value)}>
            <option value="">{t('sklad.filters.order')}</option>
            {(orders ?? []).map((o) => (
              <option key={o.id} value={o.id}>
                {o.orderNo ?? o.orderName ?? o.id}
              </option>
            ))}
          </Select>
          <Select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)}>
            <option value="">{t('sklad.filters.customer')}</option>
            {(counterparties ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">{t('sklad.filters.status')}</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`sklad.status.${s}`)}
              </option>
            ))}
          </Select>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            placeholder={t('sklad.filters.dateFrom')}
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            placeholder={t('sklad.filters.dateTo')}
          />
        </div>
      </Card>

      <Card className="p-4">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-1.5 pr-3 font-medium">{t('sklad.item.artikulLabel')}</th>
                <th className="py-1.5 pr-3 font-medium">{t('sklad.item.nameLabel')}</th>
                <th className="py-1.5 pr-3 font-medium">{t('sklad.filters.color')}</th>
                <th className="py-1.5 pr-3 font-medium">{t('sklad.filters.size')}</th>
                <th className="py-1.5 pr-3 text-right font-medium">
                  {t('sklad.batch.nettoLabel')}
                </th>
                <th className="py-1.5 pr-3 text-right font-medium">{t('sklad.batch.donaLabel')}</th>
                <th className="py-1.5 pr-3 font-medium">{t('sklad.filters.status')}</th>
                <th className="py-1.5 pr-3 font-medium">{t('sklad.filters.customer')}</th>
                <th className="py-1.5 pr-3 font-medium">{t('sklad.batch.receivedAtLabel')}</th>
                <th className="py-1.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filteredBatches.map((b) => {
                const item = itemById.get(b.itemId);
                return (
                  <tr key={b.id} className="border-b border-slate-100">
                    <td className="py-1.5 pr-3">{b.itemArtikul ?? item?.artikul ?? '—'}</td>
                    <td className="py-1.5 pr-3">{b.itemName ?? item?.name ?? '—'}</td>
                    <td className="py-1.5 pr-3">{lookupName(item?.colorId)}</td>
                    <td className="py-1.5 pr-3">{lookupName(item?.sizeId)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{b.nettoKg ?? '—'}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">
                      {b.qoldiqDona ?? b.donaSoni ?? '—'}
                    </td>
                    <td className="py-1.5 pr-3">
                      <Badge tone={STATUS_TONE[b.status]}>{t(`sklad.status.${b.status}`)}</Badge>
                    </td>
                    <td className="py-1.5 pr-3">{b.counterpartyName ?? '—'}</td>
                    <td className="py-1.5 pr-3 tabular-nums">
                      {new Date(b.omborgaKirganSana).toLocaleDateString(dateLocale)}
                    </td>
                    <td className="py-1.5 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingBatch(b);
                          setBatchModalOpen(true);
                        }}
                      >
                        {t('employees.editTooltip')}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredBatches.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-500">{t('sklad.empty')}</p>
          )}
        </div>
      </Card>

      {itemModalOpen && <ItemForm orgId={orgId} onClose={() => setItemModalOpen(false)} />}

      {batchModalOpen && (
        <BatchForm
          orgId={orgId}
          isOrgAdmin={isOrgAdmin}
          batch={editingBatch}
          onClose={() => {
            setBatchModalOpen(false);
            setEditingBatch(null);
          }}
        />
      )}
    </div>
  );
}
