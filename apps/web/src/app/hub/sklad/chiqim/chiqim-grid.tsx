'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  useIssuableBatches,
  useIssueSkladRows,
  useSkladOrders,
  useCounterparties,
} from '@mubosher/api-client';
import { clampShipmentQty, formatSize, type SkladIssueRow } from '@mubosher/shared';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Card } from '@/components/ui/Card';
import { Input, Label, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

const qtyFormat = new Intl.NumberFormat('ru-RU');
const kgFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Despatch, on a page of its own — the mirror of receiving.
 *
 * The same shape for the same reason: goods leave on one document against a
 * dozen batches, and doing that through a dialog per batch is a dozen chances
 * to lose count. Every batch with stock on it is listed; typing a quantity
 * against a row puts it on the truck.
 *
 * Quantities are capped at what the batch actually holds. The database refuses
 * an overdraw anyway, but finding that out after pressing save — with the
 * whole despatch rolled back — is a worse way to learn it.
 */
export function ChiqimGrid({ orgId }: { orgId: string }) {
  const { t } = useLocale();
  const router = useRouter();
  const [supabase] = useState(() => createSupabaseBrowserClient());

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data: batches, isLoading } = useIssuableBatches(supabase, orgId, search);
  const { data: orders } = useSkladOrders(supabase, orgId);
  const { data: counterparties } = useCounterparties(supabase, orgId);
  const issue = useIssueSkladRows(supabase);

  const [counterpartyId, setCounterpartyId] = useState('');
  const [orderId, setOrderId] = useState('');
  const [managerId, setManagerId] = useState('');
  const [documentNo, setDocumentNo] = useState('');
  const [shippedAt, setShippedAt] = useState(todayIso());
  const [note, setNote] = useState('');
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [roster, setRoster] = useState<
    { user_id: string; full_name: string | null; email: string | null }[]
  >([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState<number | null>(null);

  useEffect(() => {
    supabase.rpc('list_org_roster', { target_org_id: orgId }).then(({ data }) => {
      setRoster(data ?? []);
    });
  }, [supabase, orgId]);

  const rows = batches ?? [];

  const selected = useMemo(
    () =>
      rows
        .map((b) => ({ batch: b, dona: Number(quantities[b.batchId] ?? 0) || 0 }))
        .filter((r) => r.dona > 0),
    [rows, quantities],
  );

  const totals = useMemo(
    () =>
      selected.reduce(
        (acc, r) => ({
          dona: acc.dona + r.dona,
          kg: acc.kg + (r.batch.pieceWeightKg ?? 0) * r.dona,
        }),
        { dona: 0, kg: 0 },
      ),
    [selected],
  );

  function setQty(batchId: string, value: string, remaining: number) {
    setQuantities((q) => ({ ...q, [batchId]: clampShipmentQty(value, remaining) }));
    setSavedCount(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setSavedCount(null);

    if (!selected.length) {
      setErrorMessage(t('sklad.chiqim.nothingSelected'));
      return;
    }

    const issueRows: SkladIssueRow[] = selected.map((r) => ({
      batchId: r.batch.batchId,
      dona: String(r.dona),
      // The weight follows from the batch's own per-piece figure; sending it
      // keeps the movement's kg honest without asking anyone to weigh a pallet.
      kg: r.batch.pieceWeightKg != null ? String(r.batch.pieceWeightKg * r.dona) : undefined,
    }));

    try {
      await issue.mutateAsync({
        orgId,
        rows: issueRows,
        counterpartyId: counterpartyId || null,
        orderId: orderId || null,
        managerId: managerId || null,
        documentNo: documentNo || null,
        shippedAt,
        note: note || null,
      });
      setSavedCount(issueRows.length);
      setQuantities({});
      setDocumentNo('');
      setNote('');
    } catch (err) {
      setErrorMessage((err as Error).message);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {t('sklad.chiqim.title')}
          </h1>
          <p className="text-sm text-slate-500">{t('sklad.chiqim.description')}</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={() => router.push('/hub/sklad/stock')}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={issue.isPending || !selected.length}>
            {issue.isPending
              ? t('common.saving')
              : `${t('sklad.chiqim.save')} (${selected.length})`}
          </Button>
        </div>
      </div>

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
            <Input type="text" value={documentNo} onChange={(e) => setDocumentNo(e.target.value)} />
          </div>
          <div>
            <Label>{t('sklad.shipment.date')}</Label>
            <Input type="date" value={shippedAt} onChange={(e) => setShippedAt(e.target.value)} />
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
      {savedCount != null && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {t('sklad.chiqim.saved').replace('{n}', String(savedCount))}
        </p>
      )}

      <Card className="p-4">
        <Input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t('sklad.searchPlaceholder')}
          className="max-w-sm"
        />

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-1.5 pr-3 font-medium">{t('sklad.item.kodLabel')}</th>
                <th className="py-1.5 pr-3 font-medium">{t('sklad.item.nameLabel')}</th>
                <th className="py-1.5 pr-3 font-medium">{t('sklad.item.sizeLabel')}</th>
                <th className="py-1.5 pr-3 font-medium">{t('sklad.item.colorLabel')}</th>
                <th className="py-1.5 pr-3 font-medium">{t('sklad.item.sortLabel')}</th>
                <th className="py-1.5 pr-3 font-medium">{t('sklad.filters.order')}</th>
                <th className="py-1.5 pr-3 text-right font-medium">
                  {t('sklad.batch.qoldiqLabel')}
                </th>
                <th className="py-1.5 text-right font-medium">{t('sklad.chiqim.nowIssuing')}</th>
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
                    <td className="py-1.5 pr-3">{b.sortName ?? '—'}</td>
                    <td className="py-1.5 pr-3 text-slate-500">{b.orderNo ?? '—'}</td>
                    <td className="py-1.5 pr-3 text-right font-medium tabular-nums">
                      {qtyFormat.format(b.qoldiqDona)}
                    </td>
                    <td className="py-1.5 text-right">
                      <Input
                        type="number"
                        min={0}
                        max={b.qoldiqDona}
                        value={qty}
                        onChange={(e) => setQty(b.batchId, e.target.value, b.qoldiqDona)}
                        className="w-24 text-right tabular-nums"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {selected.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-300 font-semibold">
                  <td className="py-2 pr-3 text-xs uppercase text-slate-500" colSpan={6}>
                    {t('sklad.totals.label')}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-slate-400">
                    {kgFormat.format(totals.kg)} kg
                  </td>
                  <td className="py-2 text-right tabular-nums">{qtyFormat.format(totals.dona)}</td>
                </tr>
              </tfoot>
            )}
          </table>

          {isLoading && (
            <p className="py-6 text-center text-sm text-slate-500">{t('common.loading')}</p>
          )}
          {!isLoading && rows.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-500">{t('sklad.chiqim.empty')}</p>
          )}
        </div>
      </Card>
    </form>
  );
}
