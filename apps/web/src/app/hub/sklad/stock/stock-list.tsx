'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  useSkladBatchPage,
  useSkladItems,
  useSkladLookups,
  useSkladOrders,
  useCounterparties,
  SKLAD_PAGE_SIZE,
  type SkladBatchFilters,
} from '@mubosher/api-client';
import { formatSize, type SkladBatchStatus } from '@mubosher/shared';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Card } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge, ToggleChip } from '@/components/ui/Badge';
import { BatchForm } from '../batch-form';
import { MovementForm } from '../movement-form';

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

/** The filters kept behind the disclosure — everything except search, status
 * and the in-stock toggle, which are the three used daily. */
const EXTRA_FILTER_KEYS = [
  'productTypeId',
  'colorId',
  'pantoneId',
  'gsm',
  'widthCm',
  'lengthCm',
  'sortId',
  'orderId',
  'counterpartyId',
  'from',
  'to',
] as const satisfies readonly (keyof SkladBatchFilters)[];

const qtyFormat = new Intl.NumberFormat('ru-RU');
const kgFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
const moneyFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });

function num(value: number | null | undefined, format: Intl.NumberFormat): string {
  return value == null ? '—' : format.format(value);
}

export function StockList({ orgId, isOrgAdmin }: { orgId: string; isOrgAdmin: boolean }) {
  const { t, locale } = useLocale();
  const dateLocale = locale === 'ru' ? 'ru-RU' : 'uz-UZ';
  const [supabase] = useState(() => createSupabaseBrowserClient());

  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState<SkladBatchFilters>({ inStockOnly: false });
  const [page, setPage] = useState(0);
  const [moreFilters, setMoreFilters] = useState(false);

  // The filters go to Postgres now, so every keystroke would be a round trip.
  // A short pause is the difference between one query and fifteen.
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((f) => (f.search === searchInput ? f : { ...f, search: searchInput }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading, error } = useSkladBatchPage(supabase, orgId, filters, page);
  const { data: items } = useSkladItems(supabase, orgId);
  const { data: orders } = useSkladOrders(supabase, orgId);
  const { data: lookups } = useSkladLookups(supabase, orgId);
  const { data: counterparties } = useCounterparties(supabase, orgId);

  // Ids rather than rows: recording a movement refetches the page, and a
  // stored row object would keep showing the remainder the batch had before.
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [movementBatchId, setMovementBatchId] = useState<string | null>(null);

  const lookupsByKind = useMemo(() => {
    const map = new Map<string, NonNullable<typeof lookups>>();
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

  /** Any filter change invalidates the current page number along with it. */
  function setFilter<K extends keyof SkladBatchFilters>(key: K, value: SkladBatchFilters[K]) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(0);
  }

  /** How many of the hidden filters are doing something — otherwise a folded
   * panel silently narrows the list and the count on screen looks wrong. */
  const activeExtraFilters = EXTRA_FILTER_KEYS.filter((key) => !!filters[key]).length;

  function clearExtraFilters() {
    setFilters((f) => {
      const next = { ...f };
      for (const key of EXTRA_FILTER_KEYS) delete next[key];
      return next;
    });
    setPage(0);
  }

  const rows = data?.rows ?? [];
  const movementBatch = rows.find((r) => r.id === movementBatchId) ?? null;
  const totals = data?.totals;
  const totalCount = totals?.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalCount / SKLAD_PAGE_SIZE));
  // Admin-only column, and the RPC returns nulls here for everyone else — the
  // check is about not drawing an empty column, not about hiding the figures.
  const showMoney = isOrgAdmin;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {t('sklad.title')}
          </h1>
          <p className="text-sm text-slate-500">
            {t('sklad.totals.batches')}: {qtyFormat.format(totalCount)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setEditingBatchId(null);
              setBatchModalOpen(true);
            }}
          >
            {t('sklad.addSingleBatch')}
          </Button>
          {/* Receiving a delivery is a page of its own now: an invoice is a
              hundred rows, not one. */}
          <Link href="/hub/sklad/kirim">
            <Button type="button">{t('sklad.addBatch')}</Button>
          </Link>
        </div>
      </div>

      {/* Two rows visible, the other seven behind a disclosure.
          Eleven filters laid out at once is not power, it is a wall: the ones
          reached for daily are search, status and stock-on-hand, and the rest
          are for the twice-a-month question about a pantone code. */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('sklad.searchPlaceholder')}
            className="min-w-[220px] flex-1"
          />
          <Select
            value={filters.status ?? ''}
            onChange={(e) => setFilter('status', e.target.value as SkladBatchStatus | '')}
            className="w-44"
          >
            <option value="">{t('sklad.filters.status')}</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`sklad.status.${s}`)}
              </option>
            ))}
          </Select>
          <ToggleChip
            active={!!filters.inStockOnly}
            onClick={() => setFilter('inStockOnly', !filters.inStockOnly)}
          >
            {t('sklad.filters.inStockOnly')}
          </ToggleChip>

          <button
            type="button"
            onClick={() => setMoreFilters((open) => !open)}
            aria-expanded={moreFilters}
            className="ml-auto rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900"
          >
            {moreFilters ? t('sklad.filters.less') : t('sklad.filters.more')}
            {activeExtraFilters > 0 && (
              <span className="ml-1.5 rounded-full bg-brand-100 px-1.5 py-0.5 text-xs tabular-nums text-brand-700">
                {activeExtraFilters}
              </span>
            )}
          </button>
          {activeExtraFilters > 0 && (
            <button
              type="button"
              onClick={clearExtraFilters}
              className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-400 hover:bg-slate-50 hover:text-rose-600"
            >
              {t('sklad.filters.clear')}
            </button>
          )}
        </div>

        {moreFilters && (
          <div className="mt-3 grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select
              value={filters.productTypeId ?? ''}
              onChange={(e) => setFilter('productTypeId', e.target.value)}
            >
              <option value="">{t('sklad.filters.productType')}</option>
              {(lookupsByKind.get('mahsulot_turi') ?? []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
            <Select
              value={filters.colorId ?? ''}
              onChange={(e) => setFilter('colorId', e.target.value)}
            >
              <option value="">{t('sklad.filters.color')}</option>
              {(lookupsByKind.get('rang') ?? []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
            <Select
              value={filters.pantoneId ?? ''}
              onChange={(e) => setFilter('pantoneId', e.target.value)}
            >
              <option value="">{t('sklad.filters.pantone')}</option>
              {(lookupsByKind.get('pantone') ?? []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
            <Select value={filters.gsm ?? ''} onChange={(e) => setFilter('gsm', e.target.value)}>
              <option value="">{t('sklad.filters.gsm')}</option>
              {gsmOptions.map((g) => (
                <option key={g} value={String(g)}>
                  {g}
                </option>
              ))}
            </Select>
            <Input
              type="number"
              step="0.1"
              value={filters.lengthCm ?? ''}
              onChange={(e) => setFilter('lengthCm', e.target.value)}
              placeholder={t('sklad.item.lengthLabel')}
            />
            <Input
              type="number"
              step="0.1"
              value={filters.widthCm ?? ''}
              onChange={(e) => setFilter('widthCm', e.target.value)}
              placeholder={t('sklad.item.widthLabel')}
            />
            <Select
              value={filters.sortId ?? ''}
              onChange={(e) => setFilter('sortId', e.target.value)}
            >
              <option value="">{t('sklad.filters.sort')}</option>
              {(lookupsByKind.get('sort') ?? []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
            <Select
              value={filters.orderId ?? ''}
              onChange={(e) => setFilter('orderId', e.target.value)}
            >
              <option value="">{t('sklad.filters.order')}</option>
              {(orders ?? []).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.orderNo ?? o.orderName ?? t('sklad.order.untitled')}
                </option>
              ))}
            </Select>
            <Select
              value={filters.counterpartyId ?? ''}
              onChange={(e) => setFilter('counterpartyId', e.target.value)}
            >
              <option value="">{t('sklad.filters.customer')}</option>
              {(counterparties ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Input
              type="date"
              value={filters.from ?? ''}
              onChange={(e) => setFilter('from', e.target.value)}
              placeholder={t('sklad.filters.dateFrom')}
            />
            <Input
              type="date"
              value={filters.to ?? ''}
              onChange={(e) => setFilter('to', e.target.value)}
              placeholder={t('sklad.filters.dateTo')}
            />
          </div>
        )}
      </Card>

      {error && <p className="text-sm text-rose-600">{(error as Error).message}</p>}

      <Card className="p-4">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-1.5 pr-3 font-medium">{t('sklad.item.kodLabel')}</th>
                <th className="py-1.5 pr-3 font-medium">{t('sklad.item.nameLabel')}</th>
                <th className="py-1.5 pr-3 font-medium">{t('sklad.filters.color')}</th>
                <th className="py-1.5 pr-3 font-medium">{t('sklad.item.sizeLabel')}</th>
                <th className="py-1.5 pr-3 text-right font-medium">{t('sklad.batch.donaLabel')}</th>
                <th className="py-1.5 pr-3 text-right font-medium">
                  {t('sklad.batch.qoldiqLabel')}
                </th>
                <th className="py-1.5 pr-3 text-right font-medium">{t('sklad.totals.qoldiqKg')}</th>
                {showMoney && (
                  <th className="py-1.5 pr-3 text-right font-medium">
                    {t('sklad.price.totalAmountLabel')}
                  </th>
                )}
                <th className="py-1.5 pr-3 font-medium">{t('sklad.filters.status')}</th>
                <th className="py-1.5 pr-3 font-medium">{t('sklad.filters.customer')}</th>
                <th className="py-1.5 pr-3 font-medium">{t('sklad.batch.receivedAtLabel')}</th>
                <th className="py-1.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id} className="border-b border-slate-100">
                  <td className="py-1.5 pr-3">{b.kod ?? '—'}</td>
                  <td className="py-1.5 pr-3">{b.itemName}</td>
                  <td className="py-1.5 pr-3">{b.colorName ?? '—'}</td>
                  <td className="py-1.5 pr-3 tabular-nums">{formatSize(b.widthCm, b.lengthCm)}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-slate-500">
                    {num(b.donaSoni, qtyFormat)}
                  </td>
                  <td className="py-1.5 pr-3 text-right font-medium tabular-nums">
                    {num(b.qoldiqDona, qtyFormat)}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">
                    {num(b.qoldiqKg, kgFormat)}
                  </td>
                  {showMoney && (
                    <td className="py-1.5 pr-3 text-right tabular-nums">
                      {b.price?.totalAmount != null
                        ? `${moneyFormat.format(b.price.totalAmount)} ${b.price.currency}`
                        : '—'}
                    </td>
                  )}
                  <td className="py-1.5 pr-3">
                    <Badge tone={STATUS_TONE[b.status]}>{t(`sklad.status.${b.status}`)}</Badge>
                  </td>
                  <td className="py-1.5 pr-3">{b.counterpartyName ?? '—'}</td>
                  <td className="py-1.5 pr-3 tabular-nums">
                    {new Date(b.omborgaKirganSana).toLocaleDateString(dateLocale)}
                  </td>
                  <td className="py-1.5 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setMovementBatchId(b.id)}
                      >
                        {t('sklad.movement.action')}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingBatchId(b.id);
                          setBatchModalOpen(true);
                        }}
                      >
                        {t('common.edit')}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>

            {totals && rows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-300 font-semibold">
                  <td
                    className="py-2 pr-3 text-xs uppercase tracking-wide text-slate-500"
                    colSpan={4}
                  >
                    {t('sklad.totals.label')}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-slate-400">—</td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {qtyFormat.format(totals.qoldiqDona)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {kgFormat.format(totals.qoldiqKg)}
                  </td>
                  {showMoney && (
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {/* Shown only when every batch in the filtered set is
                          priced in the same currency — otherwise the sum would
                          be dollars added to so'm. */}
                      {totals.totalAmount != null && totals.currency
                        ? `${moneyFormat.format(totals.totalAmount)} ${totals.currency}`
                        : totals.totalAmount != null
                          ? t('sklad.totals.mixedCurrency')
                          : '—'}
                    </td>
                  )}
                  {/* status, customer, date, actions — the four that have no total */}
                  <td colSpan={4} />
                </tr>
              </tfoot>
            )}
          </table>

          {isLoading && (
            <p className="py-6 text-center text-sm text-slate-500">{t('common.loading')}</p>
          )}
          {!isLoading && rows.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-500">{t('sklad.empty')}</p>
          )}
        </div>

        {totalCount > SKLAD_PAGE_SIZE && (
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
            <span className="text-xs text-slate-500">
              {t('sklad.pagination.page')} {page + 1} / {pageCount}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                {t('sklad.pagination.previous')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={page + 1 >= pageCount}
                onClick={() => setPage((p) => p + 1)}
              >
                {t('sklad.pagination.next')}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {batchModalOpen && (
        <BatchForm
          orgId={orgId}
          isOrgAdmin={isOrgAdmin}
          batchId={editingBatchId}
          onClose={() => {
            setBatchModalOpen(false);
            setEditingBatchId(null);
          }}
        />
      )}

      {movementBatch && (
        <MovementForm
          orgId={orgId}
          batch={movementBatch}
          onClose={() => setMovementBatchId(null)}
        />
      )}
    </div>
  );
}
