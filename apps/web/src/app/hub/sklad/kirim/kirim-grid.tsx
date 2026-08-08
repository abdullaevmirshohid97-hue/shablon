'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  useSkladLookups,
  useSkladOrders,
  useReceiveSkladRows,
  useCounterparties,
  useCreateSkladOrder,
} from '@mubosher/api-client';
import { isBlankReceiveRow, summariseReceiveRows, type SkladReceiveRow } from '@mubosher/shared';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Card } from '@/components/ui/Card';
import { Input, Label, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

type Field = keyof SkladReceiveRow;

interface Column {
  field: Field;
  labelKey: string;
  /** Which lookup list suggests values for this cell, if any. */
  lookupKind?: string;
  numeric?: boolean;
  width: string;
}

/** In the order the paper invoice is written, so the eye can follow both. */
const COLUMNS: Column[] = [
  {
    field: 'productType',
    labelKey: 'sklad.item.productTypeLabel',
    lookupKind: 'mahsulot_turi',
    width: 'w-40',
  },
  { field: 'kod', labelKey: 'sklad.item.kodLabel', width: 'w-24' },
  { field: 'name', labelKey: 'sklad.item.nameLabel', width: 'w-44' },
  { field: 'gsm', labelKey: 'sklad.item.gsmLabel', numeric: true, width: 'w-20' },
  { field: 'yarnType', labelKey: 'sklad.item.yarnTypeLabel', lookupKind: 'ip_turi', width: 'w-28' },
  { field: 'length', labelKey: 'sklad.item.lengthLabel', numeric: true, width: 'w-20' },
  { field: 'width', labelKey: 'sklad.item.widthLabel', numeric: true, width: 'w-20' },
  { field: 'sort', labelKey: 'sklad.item.sortLabel', lookupKind: 'sort', width: 'w-20' },
  { field: 'color', labelKey: 'sklad.item.colorLabel', lookupKind: 'rang', width: 'w-28' },
  { field: 'pantone', labelKey: 'sklad.item.pantoneLabel', lookupKind: 'pantone', width: 'w-28' },
  { field: 'brutto', labelKey: 'sklad.batch.bruttoLabel', numeric: true, width: 'w-24' },
  { field: 'netto', labelKey: 'sklad.batch.nettoLabel', numeric: true, width: 'w-24' },
  { field: 'dona', labelKey: 'sklad.batch.donaLabel', numeric: true, width: 'w-20' },
  { field: 'nabor', labelKey: 'sklad.batch.naborLabel', numeric: true, width: 'w-20' },
  { field: 'qop', labelKey: 'sklad.batch.qopLabel', numeric: true, width: 'w-20' },
  { field: 'notes', labelKey: 'sklad.batch.notesLabel', width: 'w-40' },
];

const EMPTY_ROW: SkladReceiveRow = {};
const INITIAL_ROWS = 8;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const cellClass =
  'w-full rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm text-slate-900 ' +
  'outline-none transition-colors hover:border-slate-200 focus:border-brand-500 focus:bg-white';

/**
 * Receiving a delivery the way it is actually done: a page of its own, one row
 * per invoice line, every cell typed.
 *
 * It replaces the modal that took one batch at a time. The invoices this
 * warehouse works from run to a hundred and sixty lines, and opening, filling
 * and closing a dialog a hundred and sixty times is not data entry.
 *
 * Every text cell is a plain input with a datalist behind it — the existing
 * values are offered, and a value that does not exist yet is simply typed and
 * created on save. The dropdown-only version was fewer typos and more
 * dead ends: no one can receive today's cloth until an admin adds its colour.
 */
export function KirimGrid({ orgId }: { orgId: string }) {
  const { t } = useLocale();
  const router = useRouter();
  const [supabase] = useState(() => createSupabaseBrowserClient());

  const { data: lookups } = useSkladLookups(supabase, orgId);
  const { data: orders } = useSkladOrders(supabase, orgId);
  const { data: counterparties } = useCounterparties(supabase, orgId);
  const receive = useReceiveSkladRows(supabase);
  const createOrder = useCreateSkladOrder(supabase);

  const [receivedAt, setReceivedAt] = useState(todayIso());
  const [orderId, setOrderId] = useState('');
  const [rows, setRows] = useState<SkladReceiveRow[]>(() =>
    Array.from({ length: INITIAL_ROWS }, () => ({ ...EMPTY_ROW })),
  );
  const [newOrderNo, setNewOrderNo] = useState('');
  const [newOrderCustomer, setNewOrderCustomer] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState<number | null>(null);

  const suggestions = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const l of lookups ?? []) {
      const list = map.get(l.kind) ?? [];
      list.push(l.name);
      map.set(l.kind, list);
    }
    return map;
  }, [lookups]);

  const filledRows = useMemo(() => rows.filter((r) => !isBlankReceiveRow(r)), [rows]);

  const totals = useMemo(() => summariseReceiveRows(rows), [rows]);

  function setCell(rowIndex: number, field: Field, value: string) {
    setRows((current) => {
      const next = current.map((r, i) => (i === rowIndex ? { ...r, [field]: value } : r));
      // Typing in the last row means there is more invoice to come.
      if (rowIndex === next.length - 1 && value.trim()) next.push({ ...EMPTY_ROW });
      return next;
    });
    setSavedCount(null);
  }

  /** Repeats the row above into this one — consecutive invoice lines differ in
   * a weight and a count and nothing else. */
  function copyFromAbove(rowIndex: number) {
    setRows((current) => {
      const above = current[rowIndex - 1];
      if (!above) return current;
      // Everything except the figures that are specific to this bale.
      const copy = { ...above, brutto: '', netto: '', dona: '' };
      return current.map((r, i) => (i === rowIndex ? copy : r));
    });
  }

  function removeRow(rowIndex: number) {
    setRows((current) =>
      current.length <= 1 ? [{ ...EMPTY_ROW }] : current.filter((_, i) => i !== rowIndex),
    );
  }

  async function handleAddOrder() {
    const created = await createOrder.mutateAsync({
      orgId,
      orderNo: newOrderNo || null,
      orderName: null,
      counterpartyId: newOrderCustomer || null,
    });
    setOrderId(created.id);
    setNewOrderNo('');
    setNewOrderCustomer('');
  }

  async function handleSave() {
    setErrorMessage(null);
    setSavedCount(null);

    if (!filledRows.length) {
      setErrorMessage(t('sklad.kirim.nothingToSave'));
      return;
    }

    try {
      const saved = await receive.mutateAsync({
        orgId,
        orderId: orderId || null,
        receivedAt,
        // The whole grid, blanks and all: the database skips untouched rows
        // and names the position of any row it refuses, and that position has
        // to match the № the storekeeper is looking at.
        rows,
      });
      setSavedCount(saved);

      // Only when everything landed. Wiping the grid on a partial save is what
      // turned a refused row into a lost invoice.
      if (saved === filledRows.length) {
        setRows(Array.from({ length: INITIAL_ROWS }, () => ({ ...EMPTY_ROW })));
      } else {
        setErrorMessage(
          t('sklad.kirim.partialSave')
            .replace('{saved}', String(saved))
            .replace('{sent}', String(filledRows.length)),
        );
      }
    } catch (err) {
      setErrorMessage((err as Error).message);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {t('sklad.kirim.title')}
          </h1>
          <p className="text-sm text-slate-500">{t('sklad.kirim.description')}</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={() => router.push('/hub/sklad/stock')}>
            {t('common.cancel')}
          </Button>
          <Button type="button" disabled={receive.isPending} onClick={() => void handleSave()}>
            {receive.isPending
              ? t('common.saving')
              : `${t('sklad.kirim.save')} (${filledRows.length})`}
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>{t('sklad.batch.receivedAtLabel')}</Label>
            <Input type="date" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} />
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
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label>{t('sklad.kirim.newOrderNo')}</Label>
              <Input
                type="text"
                value={newOrderNo}
                onChange={(e) => setNewOrderNo(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <Label>{t('sklad.batch.customerLabel')}</Label>
              <Select
                value={newOrderCustomer}
                onChange={(e) => setNewOrderCustomer(e.target.value)}
              >
                <option value="">—</option>
                {(counterparties ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!newOrderNo.trim() || createOrder.isPending}
              onClick={() => void handleAddOrder()}
            >
              +
            </Button>
          </div>
        </div>
      </Card>

      {errorMessage && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{errorMessage}</p>
      )}
      {savedCount != null && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {t('sklad.kirim.saved').replace('{n}', String(savedCount))}
        </p>
      )}

      <Card className="p-2">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="w-10 px-1 py-2 text-center font-medium">№</th>
                {COLUMNS.map((c) => (
                  <th key={c.field} className={`px-1 py-2 font-medium ${c.width}`}>
                    {t(c.labelKey)}
                  </th>
                ))}
                <th className="w-16 px-1 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className={`border-b border-slate-100 ${isBlankReceiveRow(row) ? '' : 'bg-slate-50/40'}`}
                >
                  <td className="px-1 py-0.5 text-center text-xs text-slate-400">{rowIndex + 1}</td>
                  {COLUMNS.map((c) => (
                    <td key={c.field} className="px-0.5 py-0.5">
                      <input
                        className={`${cellClass} ${c.numeric ? 'text-right tabular-nums' : ''}`}
                        type={c.numeric ? 'number' : 'text'}
                        step={c.numeric ? 'any' : undefined}
                        list={c.lookupKind ? `sklad-suggest-${c.lookupKind}` : undefined}
                        value={row[c.field] ?? ''}
                        onChange={(e) => setCell(rowIndex, c.field, e.target.value)}
                      />
                    </td>
                  ))}
                  <td className="px-1 py-0.5">
                    <div className="flex justify-end gap-0.5">
                      <button
                        type="button"
                        title={t('sklad.kirim.copyAbove')}
                        onClick={() => copyFromAbove(rowIndex)}
                        className="rounded px-1.5 py-0.5 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        title={t('common.delete')}
                        onClick={() => removeRow(rowIndex)}
                        className="rounded px-1.5 py-0.5 text-xs text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      >
                        ×
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              {/* Column arithmetic: 1 (№) + 11 columns up to and including
                  brutto = 12, then netto, then dona, then the three that carry
                  no total, then the actions column. */}
              <tr className="border-t-2 border-slate-300 text-sm font-semibold">
                <td className="px-1 py-2 text-xs uppercase text-slate-500" colSpan={12}>
                  {t('sklad.totals.label')}
                </td>
                <td className="px-1 py-2 text-right tabular-nums">
                  {totals.nettoKg ? totals.nettoKg.toFixed(2) : ''}
                </td>
                <td className="px-1 py-2 text-right tabular-nums">{totals.dona || ''}</td>
                <td colSpan={4} />
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="mt-2 flex items-center justify-between px-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setRows((r) => [...r, { ...EMPTY_ROW }])}
          >
            {t('sklad.kirim.addRow')}
          </Button>
          <span className="text-xs text-slate-400">{t('sklad.kirim.hint')}</span>
        </div>
      </Card>

      {/* One datalist per lookup kind, shared by every cell in that column. */}
      {['mahsulot_turi', 'ip_turi', 'sort', 'rang', 'pantone'].map((kind) => (
        <datalist key={kind} id={`sklad-suggest-${kind}`}>
          {(suggestions.get(kind) ?? []).map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      ))}
    </div>
  );
}
