'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useSkladInvoices,
  useCreateSkladInvoice,
  useIssuableBatches,
  useSkladOrders,
  useCounterparties,
} from '@mubosher/api-client';
import {
  clampShipmentQty,
  formatSize,
  type SkladInvoiceRow,
  type SkladInvoiceStatus,
} from '@mubosher/shared';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Card } from '@/components/ui/Card';
import { Input, Label, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

const ALL_STATUSES: SkladInvoiceStatus[] = ['yangi', 'qisman', 'bajarildi', 'bekor'];

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

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * The sales invoice: what a manager raises, and the queue the loading bay
 * works from.
 *
 * Lines are picked from actual stock rather than typed free-hand, because a
 * faktura promising goods that are not on the shelf is discovered at the
 * loading bay by someone who cannot fix it. What each batch holds is shown
 * beside every line, and the quantity is capped at it.
 */
export function FakturaList({ orgId, isOrgAdmin }: { orgId: string; isOrgAdmin: boolean }) {
  const { t, locale } = useLocale();
  const dateLocale = locale === 'ru' ? 'ru-RU' : 'uz-UZ';
  const router = useRouter();
  const [supabase] = useState(() => createSupabaseBrowserClient());

  const [status, setStatus] = useState<SkladInvoiceStatus | ''>('');
  const [search, setSearch] = useState('');
  const { data: invoices } = useSkladInvoices(supabase, orgId, { status, search });
  const { data: counterparties } = useCounterparties(supabase, orgId);
  const { data: orders } = useSkladOrders(supabase, orgId);
  const createInvoice = useCreateSkladInvoice(supabase);

  const [formOpen, setFormOpen] = useState(false);
  const [batchSearch, setBatchSearch] = useState('');
  const { data: batches } = useIssuableBatches(supabase, orgId, formOpen ? batchSearch : '');

  const [counterpartyId, setCounterpartyId] = useState('');
  const [orderId, setOrderId] = useState('');
  const [issuedAt, setIssuedAt] = useState(todayIso());
  const [dueDate, setDueDate] = useState('');
  const [currency, setCurrency] = useState('UZS');
  const [note, setNote] = useState('');
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const rows = batches ?? [];

  const selected = useMemo(
    () =>
      rows
        .map((b) => ({
          batch: b,
          dona: Number(quantities[b.batchId] ?? 0) || 0,
          price: Number(prices[b.batchId] ?? 0) || 0,
        }))
        .filter((r) => r.dona > 0),
    [rows, quantities, prices],
  );

  const total = useMemo(() => selected.reduce((sum, r) => sum + r.dona * r.price, 0), [selected]);

  function resetForm() {
    setQuantities({});
    setPrices({});
    setNote('');
    setDueDate('');
    setFormOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    if (!counterpartyId) {
      setErrorMessage(t('sklad.faktura.needClient'));
      return;
    }
    if (!selected.length) {
      setErrorMessage(t('sklad.faktura.needLines'));
      return;
    }

    const invoiceRows: SkladInvoiceRow[] = selected.map((r) => ({
      itemId: r.batch.itemId,
      batchId: r.batch.batchId,
      dona: String(r.dona),
      kg: r.batch.pieceWeightKg != null ? String(r.batch.pieceWeightKg * r.dona) : undefined,
      unitPrice: prices[r.batch.batchId] || undefined,
    }));

    try {
      const invoiceId = await createInvoice.mutateAsync({
        orgId,
        counterpartyId,
        rows: invoiceRows,
        orderId: orderId || null,
        issuedAt,
        dueDate: dueDate || null,
        currency,
        note: note || null,
      });
      resetForm();
      // Straight to the printable copy: raising one and printing it is a
      // single act, and asking the manager to find it again is friction.
      router.push(`/hub/sotuv/faktura/${invoiceId}`);
    } catch (err) {
      setErrorMessage((err as Error).message);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {t('sklad.faktura.title')}
          </h1>
          <p className="text-sm text-slate-500">{t('sklad.faktura.description')}</p>
        </div>
        <Button type="button" onClick={() => setFormOpen((open) => !open)}>
          {formOpen ? t('common.cancel') : t('sklad.faktura.create')}
        </Button>
      </div>

      {formOpen && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Card className="p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
                <Label>{t('sklad.batch.orderLabel')}</Label>
                <Select value={orderId} onChange={(e) => setOrderId(e.target.value)}>
                  <option value="">—</option>
                  {(orders ?? []).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.orderNo ?? o.orderName ?? t('sklad.order.untitled')}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>{t('sklad.faktura.issuedAt')}</Label>
                <Input type="date" value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} />
              </div>
              <div>
                <Label>{t('sklad.faktura.dueDate')}</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <div>
                <Label>{t('sklad.price.currencyLabel')}</Label>
                <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  {['UZS', 'USD', 'EUR', 'RUB'].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="mt-3">
              <Label>{t('sklad.batch.notesLabel')}</Label>
              <Input type="text" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </Card>

          {errorMessage && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{errorMessage}</p>
          )}

          <Card className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Input
                type="text"
                value={batchSearch}
                onChange={(e) => setBatchSearch(e.target.value)}
                placeholder={t('sklad.searchPlaceholder')}
                className="max-w-sm"
              />
              <Button type="submit" disabled={createInvoice.isPending || !selected.length}>
                {createInvoice.isPending
                  ? t('common.saving')
                  : `${t('sklad.faktura.save')} (${selected.length})`}
              </Button>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                    <th className="py-1.5 pr-3 font-medium">{t('sklad.item.kodLabel')}</th>
                    <th className="py-1.5 pr-3 font-medium">{t('sklad.item.nameLabel')}</th>
                    <th className="py-1.5 pr-3 font-medium">{t('sklad.item.sizeLabel')}</th>
                    <th className="py-1.5 pr-3 font-medium">{t('sklad.item.colorLabel')}</th>
                    <th className="py-1.5 pr-3 text-right font-medium">
                      {t('sklad.batch.qoldiqLabel')}
                    </th>
                    <th className="py-1.5 pr-3 text-right font-medium">{t('sklad.faktura.qty')}</th>
                    <th className="py-1.5 text-right font-medium">
                      {t('sklad.faktura.unitPrice')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((b) => {
                    const qty = quantities[b.batchId] ?? '';
                    return (
                      <tr
                        key={b.batchId}
                        className={`border-b border-slate-100 ${qty ? 'bg-brand-50/40' : ''}`}
                      >
                        <td className="py-1.5 pr-3">{b.kod ?? '—'}</td>
                        <td className="py-1.5 pr-3">{b.itemName}</td>
                        <td className="py-1.5 pr-3 tabular-nums">
                          {formatSize(b.widthCm, b.lengthCm)}
                        </td>
                        <td className="py-1.5 pr-3">{b.colorName ?? '—'}</td>
                        <td className="py-1.5 pr-3 text-right font-medium tabular-nums">
                          {qtyFormat.format(b.qoldiqDona)}
                        </td>
                        <td className="py-1.5 pr-3 text-right">
                          <Input
                            type="number"
                            min={0}
                            max={b.qoldiqDona}
                            value={qty}
                            onChange={(e) =>
                              setQuantities((q) => ({
                                ...q,
                                [b.batchId]: clampShipmentQty(e.target.value, b.qoldiqDona),
                              }))
                            }
                            className="w-24 text-right tabular-nums"
                          />
                        </td>
                        <td className="py-1.5 text-right">
                          <Input
                            type="number"
                            step="0.01"
                            value={prices[b.batchId] ?? ''}
                            onChange={(e) =>
                              setPrices((p) => ({ ...p, [b.batchId]: e.target.value }))
                            }
                            className="w-28 text-right tabular-nums"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {selected.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 font-semibold">
                      <td className="py-2 pr-3 text-xs uppercase text-slate-500" colSpan={5}>
                        {t('sklad.totals.label')}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {qtyFormat.format(selected.reduce((n, r) => n + r.dona, 0))}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {moneyFormat.format(total)} {currency}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
              {rows.length === 0 && (
                <p className="py-6 text-center text-sm text-slate-500">{t('sklad.chiqim.empty')}</p>
              )}
            </div>
          </Card>
        </form>
      )}

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('sklad.faktura.searchPlaceholder')}
            className="min-w-[220px] flex-1"
          />
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as SkladInvoiceStatus | '')}
            className="w-48"
          >
            <option value="">{t('sklad.order.statusLabel')}</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`sklad.invoiceStatus.${s}`)}
              </option>
            ))}
          </Select>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-1.5 pr-3 font-medium">{t('sklad.faktura.number')}</th>
                <th className="py-1.5 pr-3 font-medium">{t('sklad.batch.customerLabel')}</th>
                <th className="py-1.5 pr-3 font-medium">{t('sklad.order.manager')}</th>
                <th className="py-1.5 pr-3 font-medium">{t('sklad.faktura.issuedAt')}</th>
                <th className="py-1.5 pr-3 text-right font-medium">{t('sklad.faktura.qty')}</th>
                <th className="py-1.5 pr-3 text-right font-medium">{t('sklad.order.shipped')}</th>
                {isOrgAdmin && (
                  <th className="py-1.5 pr-3 text-right font-medium">
                    {t('sklad.price.totalAmountLabel')}
                  </th>
                )}
                <th className="py-1.5 font-medium">{t('sklad.order.statusLabel')}</th>
              </tr>
            </thead>
            <tbody>
              {(invoices ?? []).map((inv) => (
                <tr key={inv.invoiceId} className="border-b border-slate-100">
                  <td className="py-1.5 pr-3">
                    <Link
                      href={`/hub/sotuv/faktura/${inv.invoiceId}`}
                      className="font-medium text-brand-700 hover:underline"
                    >
                      {inv.invoiceNo ?? '—'}
                    </Link>
                  </td>
                  <td className="py-1.5 pr-3">{inv.counterpartyName}</td>
                  <td className="py-1.5 pr-3 text-slate-600">{inv.managerName ?? '—'}</td>
                  <td className="py-1.5 pr-3 tabular-nums text-slate-500">
                    {new Date(inv.issuedAt).toLocaleDateString(dateLocale)}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">
                    {qtyFormat.format(inv.orderedDona)}
                  </td>
                  <td className="py-1.5 pr-3 text-right font-medium tabular-nums">
                    {qtyFormat.format(inv.shippedDona)}
                  </td>
                  {isOrgAdmin && (
                    <td className="py-1.5 pr-3 text-right tabular-nums">
                      {inv.totalAmount != null
                        ? `${moneyFormat.format(inv.totalAmount)} ${inv.currency}`
                        : '—'}
                    </td>
                  )}
                  <td className="py-1.5">
                    <Badge tone={STATUS_TONE[inv.status]}>
                      {t(`sklad.invoiceStatus.${inv.status}`)}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {invoices?.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-500">{t('sklad.faktura.empty')}</p>
          )}
        </div>
      </Card>
    </div>
  );
}
