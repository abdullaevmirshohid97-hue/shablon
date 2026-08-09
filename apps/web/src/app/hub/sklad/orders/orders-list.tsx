'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  useSkladOrders,
  useCreateSkladOrder,
  useUpdateSkladOrder,
  useDeleteSkladOrder,
  useCounterparties,
} from '@mubosher/api-client';
import type { SkladOrder } from '@mubosher/shared';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Card } from '@/components/ui/Card';
import { Input, Label, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

const FK_VIOLATION = '23503';

function OrderForm({
  orgId,
  order,
  onClose,
}: {
  orgId: string;
  order: SkladOrder | null;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const { data: counterparties } = useCounterparties(supabase, orgId);
  const createOrder = useCreateSkladOrder(supabase);
  const updateOrder = useUpdateSkladOrder(supabase);

  const [orderNo, setOrderNo] = useState(order?.orderNo ?? '');
  const [orderName, setOrderName] = useState(order?.orderName ?? '');
  const [counterpartyId, setCounterpartyId] = useState(order?.counterpartyId ?? '');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const saving = createOrder.isPending || updateOrder.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    const input = {
      orgId,
      orderNo: orderNo || null,
      orderName: orderName || null,
      counterpartyId: counterpartyId || null,
    };

    try {
      if (order) {
        await updateOrder.mutateAsync({ orderId: order.id, ...input });
      } else {
        await createOrder.mutateAsync(input);
      }
      onClose();
    } catch (err) {
      setErrorMessage((err as Error).message);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-scrim/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-popover">
        <h2 className="mb-4 text-base font-semibold text-slate-900">{t('sklad.order.title')}</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <Label>{t('sklad.batch.orderNoLabel')}</Label>
            <Input type="text" value={orderNo} onChange={(e) => setOrderNo(e.target.value)} />
          </div>
          <div>
            <Label>{t('sklad.batch.orderNameLabel')}</Label>
            <Input type="text" value={orderName} onChange={(e) => setOrderName(e.target.value)} />
          </div>
          <div>
            <Label>{t('sklad.batch.customerLabel')}</Label>
            <Select value={counterpartyId} onChange={(e) => setCounterpartyId(e.target.value)}>
              <option value="">—</option>
              {(counterparties ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>

          {errorMessage && <p className="text-sm text-rose-600">{errorMessage}</p>}

          <div className="mt-1 flex gap-2">
            <Button type="submit" disabled={saving || (!orderNo.trim() && !orderName.trim())}>
              {saving ? t('common.saving') : t('common.save')}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>
              {t('common.cancel')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Orders, on their own screen.
 *
 * They could only be created from inside the batch modal before, never renamed
 * and never corrected — and a blank one showed up in the dropdown as a raw
 * uuid. Requiring a number or a name at the form is what stops that at source.
 */
export function OrdersList({ orgId, isOrgAdmin }: { orgId: string; isOrgAdmin: boolean }) {
  const { t, locale } = useLocale();
  const dateLocale = locale === 'ru' ? 'ru-RU' : 'uz-UZ';
  const [supabase] = useState(() => createSupabaseBrowserClient());

  const { data: orders } = useSkladOrders(supabase, orgId);
  const { data: counterparties } = useCounterparties(supabase, orgId);
  const deleteOrder = useDeleteSkladOrder(supabase);

  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<SkladOrder | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const customerName = useMemo(() => {
    const map = new Map((counterparties ?? []).map((c) => [c.id, c.name]));
    return (id: string | null | undefined) => (id ? (map.get(id) ?? '—') : '—');
  }, [counterparties]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders ?? [];
    return (orders ?? []).filter((o) =>
      `${o.orderNo ?? ''} ${o.orderName ?? ''}`.toLowerCase().includes(q),
    );
  }, [orders, search]);

  async function handleDelete(order: SkladOrder) {
    if (!window.confirm(t('sklad.order.deleteConfirm'))) return;
    setErrorMessage(null);
    try {
      await deleteOrder.mutateAsync({ orgId, orderId: order.id });
    } catch (err) {
      const code = (err as { code?: string }).code;
      setErrorMessage(
        code === FK_VIOLATION ? t('sklad.order.deleteInUse') : (err as Error).message,
      );
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {t('sklad.nav.orders')}
        </h1>
        <Button
          type="button"
          onClick={() => {
            setEditingOrder(null);
            setFormOpen(true);
          }}
        >
          {t('sklad.order.addButton')}
        </Button>
      </div>

      <Card className="p-4">
        <Input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('sklad.order.searchPlaceholder')}
          className="max-w-sm"
        />

        {errorMessage && <p className="mt-3 text-sm text-rose-600">{errorMessage}</p>}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[700px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-1.5 pr-3 font-medium">{t('sklad.batch.orderNoLabel')}</th>
                <th className="py-1.5 pr-3 font-medium">{t('sklad.batch.orderNameLabel')}</th>
                <th className="py-1.5 pr-3 font-medium">{t('sklad.batch.customerLabel')}</th>
                <th className="py-1.5 pr-3 font-medium">{t('sklad.order.createdAt')}</th>
                <th className="py-1.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} className="border-b border-slate-100">
                  <td className="py-1.5 pr-3 font-medium">
                    <Link
                      href={`/hub/sklad/orders/${o.id}`}
                      className="text-brand-700 hover:underline"
                    >
                      {o.orderNo ?? o.orderName ?? t('sklad.order.untitled')}
                    </Link>
                  </td>
                  <td className="py-1.5 pr-3">{o.orderName ?? '—'}</td>
                  <td className="py-1.5 pr-3">{customerName(o.counterpartyId)}</td>
                  <td className="py-1.5 pr-3 tabular-nums text-slate-500">
                    {new Date(o.createdAt).toLocaleDateString(dateLocale)}
                  </td>
                  <td className="py-1.5 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingOrder(o);
                          setFormOpen(true);
                        }}
                      >
                        {t('common.edit')}
                      </Button>
                      {isOrgAdmin && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleDelete(o)}
                        >
                          {t('common.delete')}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-500">{t('sklad.order.empty')}</p>
          )}
        </div>
      </Card>

      {formOpen && (
        <OrderForm
          orgId={orgId}
          order={editingOrder}
          onClose={() => {
            setFormOpen(false);
            setEditingOrder(null);
          }}
        />
      )}
    </div>
  );
}
