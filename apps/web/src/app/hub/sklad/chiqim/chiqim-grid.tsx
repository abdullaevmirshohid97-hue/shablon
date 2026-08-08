'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useIssuableBatches,
  useIssueSkladRows,
  useInvoiceByCode,
  useSkladInvoices,
  useSkladOrders,
  useCounterparties,
} from '@mubosher/api-client';
import { clampShipmentQty, formatSize, type SkladIssueRow } from '@mubosher/shared';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Card } from '@/components/ui/Card';
import { Input, Label, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

const qtyFormat = new Intl.NumberFormat('ru-RU');
const kgFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Despatch, driven by the paper the manager printed.
 *
 * The storekeeper scans the invoice — barcode from the desk scanner, or the QR
 * from a phone, or the number typed by hand; all three resolve through one
 * lookup. The client, the order and the document number come off the document,
 * and every line that still owes goods is filled in with what it owes, capped
 * at what the batch actually holds.
 *
 * Nothing about that is mandatory: a despatch with no invoice behind it is
 * still a despatch, and the grid works exactly as it did before. But the
 * common case — the one that used to start with a phone call to the office —
 * is now a scan.
 */
export function ChiqimGrid({ orgId }: { orgId: string }) {
  const { t, locale } = useLocale();
  const dateLocale = locale === 'ru' ? 'ru-RU' : 'uz-UZ';
  const router = useRouter();
  const [supabase] = useState(() => createSupabaseBrowserClient());

  // --- scanning -------------------------------------------------------
  const scanRef = useRef<HTMLInputElement>(null);
  const [scanInput, setScanInput] = useState('');
  const [scanCode, setScanCode] = useState('');
  const [appliedInvoiceId, setAppliedInvoiceId] = useState<string | null>(null);
  const { data: scanned, isFetching: scanning } = useInvoiceByCode(supabase, orgId, scanCode);

  // --- the grid -------------------------------------------------------
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data: batches, isLoading } = useIssuableBatches(supabase, orgId, search);
  const { data: orders } = useSkladOrders(supabase, orgId);
  const { data: counterparties } = useCounterparties(supabase, orgId);
  const { data: pending } = useSkladInvoices(supabase, orgId, { status: 'yangi' });
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
  const [savedShipmentId, setSavedShipmentId] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc('list_org_roster', { target_org_id: orgId }).then(({ data }) => {
      setRoster(data ?? []);
    });
  }, [supabase, orgId]);

  // A hardware scanner is a keyboard: it types into whatever has focus and
  // presses Enter. Keeping this field focused is what makes it work at all.
  useEffect(() => {
    scanRef.current?.focus();
  }, []);

  const rows = batches ?? [];
  const batchById = useMemo(() => new Map(rows.map((b) => [b.batchId, b])), [rows]);

  /**
   * A resolved invoice fills the header and the quantities once, then leaves
   * the storekeeper alone — they may have counted out something different from
   * what the paper says, and the paper is not the authority on what physically
   * went on the truck.
   */
  useEffect(() => {
    if (!scanned || scanned.invoiceId === appliedInvoiceId) return;

    setAppliedInvoiceId(scanned.invoiceId);
    setCounterpartyId(scanned.counterpartyId ?? '');
    setOrderId(scanned.orderId ?? '');
    setDocumentNo(scanned.invoiceNo ?? '');

    const next: Record<string, string> = {};
    for (const line of scanned.lines) {
      if (!line.batchId || line.remainingDona <= 0) continue;
      // Capped at the shelf, not at the paper: an invoice may promise more
      // than the batch turned out to hold.
      const available = line.batchQoldiqDona ?? line.remainingDona;
      next[line.batchId] = String(Math.min(line.remainingDona, available));
    }
    setQuantities(next);
    setScanInput('');
    setErrorMessage(null);
    setSavedShipmentId(null);
  }, [scanned, appliedInvoiceId]);

  const selected = useMemo(
    () =>
      Object.entries(quantities)
        .map(([batchId, value]) => ({ batchId, dona: Number(value) || 0 }))
        .filter((r) => r.dona > 0),
    [quantities],
  );

  const totals = useMemo(
    () =>
      selected.reduce(
        (acc, r) => {
          const batch = batchById.get(r.batchId);
          return {
            dona: acc.dona + r.dona,
            kg: acc.kg + (batch?.pieceWeightKg ?? 0) * r.dona,
          };
        },
        { dona: 0, kg: 0 },
      ),
    [selected, batchById],
  );

  function applyScan(code: string) {
    const trimmed = code.trim();
    if (!trimmed) return;
    // A re-scan of the same code has to re-apply, so the key is reset first.
    setAppliedInvoiceId(null);
    setScanCode(trimmed);
  }

  function clearInvoice() {
    setAppliedInvoiceId(null);
    setScanCode('');
    setScanInput('');
    setQuantities({});
    setDocumentNo('');
    scanRef.current?.focus();
  }

  function setQty(batchId: string, value: string, remaining: number) {
    setQuantities((q) => ({ ...q, [batchId]: clampShipmentQty(value, remaining) }));
    setSavedShipmentId(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setSavedShipmentId(null);

    if (!selected.length) {
      setErrorMessage(t('sklad.chiqim.nothingSelected'));
      return;
    }

    const issueRows: SkladIssueRow[] = selected.map((r) => {
      const batch = batchById.get(r.batchId);
      return {
        batchId: r.batchId,
        dona: String(r.dona),
        kg: batch?.pieceWeightKg != null ? String(batch.pieceWeightKg * r.dona) : undefined,
      };
    });

    try {
      const shipmentId = await issue.mutateAsync({
        orgId,
        rows: issueRows,
        counterpartyId: counterpartyId || null,
        orderId: orderId || null,
        managerId: managerId || null,
        documentNo: documentNo || null,
        shippedAt,
        note: note || null,
        invoiceId: appliedInvoiceId,
      });
      setSavedShipmentId(shipmentId);
      setQuantities({});
      setNote('');
      clearInvoice();
    } catch (err) {
      setErrorMessage((err as Error).message);
    }
  }

  const scanMissed = scanCode.length > 0 && !scanning && !scanned;

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

      {/* The scanner lives at the top and holds focus: it is the first thing
          that happens at the desk, and everything below it follows. */}
      <Card className="border-brand-200 bg-brand-50/40 p-4">
        <Label>{t('sklad.chiqim.scanLabel')}</Label>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <Input
            ref={scanRef}
            type="text"
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              // The scanner's trailing Enter would otherwise submit the whole
              // despatch before a single quantity had been checked.
              e.preventDefault();
              applyScan(scanInput);
            }}
            placeholder={t('sklad.chiqim.scanPlaceholder')}
            className="min-w-[240px] flex-1 font-mono"
            autoComplete="off"
          />
          <Button type="button" variant="secondary" onClick={() => applyScan(scanInput)}>
            {t('sklad.chiqim.scanButton')}
          </Button>
        </div>

        {scanning && <p className="mt-2 text-sm text-slate-500">{t('common.loading')}</p>}
        {scanMissed && <p className="mt-2 text-sm text-rose-600">{t('sklad.chiqim.scanMissed')}</p>}

        {scanned && appliedInvoiceId === scanned.invoiceId && (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-white px-3 py-2 text-sm">
            <Link
              href={`/hub/sklad/faktura/${scanned.invoiceId}`}
              className="font-semibold text-brand-700 hover:underline"
            >
              {scanned.invoiceNo}
            </Link>
            <span className="text-slate-900">{scanned.counterpartyName}</span>
            <Badge tone={scanned.status === 'qisman' ? 'warning' : 'neutral'}>
              {t(`sklad.invoiceStatus.${scanned.status}`)}
            </Badge>
            <span className="text-slate-500">
              {t('sklad.order.remaining')}:{' '}
              {qtyFormat.format(scanned.lines.reduce((n, l) => n + l.remainingDona, 0))}
            </span>
            <button
              type="button"
              onClick={clearInvoice}
              className="ml-auto rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-rose-600"
            >
              {t('sklad.chiqim.clearInvoice')}
            </button>
          </div>
        )}

        {/* Invoices still owing goods, for a desk with no scanner to hand. */}
        {!appliedInvoiceId && (pending?.length ?? 0) > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {(pending ?? []).slice(0, 8).map((inv) => (
              <button
                key={inv.invoiceId}
                type="button"
                onClick={() => applyScan(inv.invoiceId)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-brand-500 hover:text-brand-700"
              >
                {inv.invoiceNo} · {inv.counterpartyName} ·{' '}
                {qtyFormat.format(inv.orderedDona - inv.shippedDona)}
              </button>
            ))}
          </div>
        )}
      </Card>

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
      {savedShipmentId && (
        <p className="flex flex-wrap items-center gap-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {t('sklad.chiqim.savedNote')}
          <Link
            href={`/hub/sklad/chiqim/${savedShipmentId}`}
            className="font-semibold underline underline-offset-2"
          >
            {t('sklad.chiqim.openNote')}
          </Link>
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

        {/* A scanned line whose batch is not on this page would otherwise
            vanish silently — say so rather than shipping short. */}
        {appliedInvoiceId && scanned && (
          <>
            {scanned.lines.some((l) => l.batchId && !batchById.has(l.batchId)) && (
              <p className="mt-3 text-sm text-amber-700">{t('sklad.chiqim.linesOffPage')}</p>
            )}
            {scanned.lines.some((l) => !l.batchId) && (
              <p className="mt-1 text-sm text-slate-500">
                {t('sklad.chiqim.linesWithoutBatch')} ·{' '}
                {new Date(scanned.issuedAt).toLocaleDateString(dateLocale)}
              </p>
            )}
          </>
        )}
      </Card>
    </form>
  );
}
