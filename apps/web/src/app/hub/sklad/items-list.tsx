'use client';

import { useMemo, useState } from 'react';
import {
  useSkladItems,
  useSkladLookups,
  useSkladStock,
  useDeleteSkladItem,
} from '@mubosher/api-client';
import type { SkladItem } from '@mubosher/shared';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ItemForm } from './item-form';

const qtyFormat = new Intl.NumberFormat('ru-RU');
const kgFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
const moneyFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });

/** Postgres foreign-key violation. A card in use cannot be deleted, and saying
 * why is more useful than relaying the constraint name. */
const FK_VIOLATION = '23503';

/**
 * The product cards themselves, with what is currently on the shelves for
 * each.
 *
 * A card was creatable and never editable: ItemForm has taken an `item` prop
 * since it was written, but nothing ever passed one, so a mistyped artikul was
 * permanent. The stock columns come from sklad_stock_by_item (0023) — the
 * question a manager asks before any of the batch detail is "how much of this
 * do we have".
 */
export function ItemsList({ orgId, isOrgAdmin }: { orgId: string; isOrgAdmin: boolean }) {
  const { t } = useLocale();
  const [supabase] = useState(() => createSupabaseBrowserClient());

  const { data: items } = useSkladItems(supabase, orgId);
  const { data: lookups } = useSkladLookups(supabase, orgId);
  const { data: stock } = useSkladStock(supabase, orgId);
  const deleteItem = useDeleteSkladItem(supabase);

  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SkladItem | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const lookupName = useMemo(() => {
    const map = new Map((lookups ?? []).map((l) => [l.id, l.name]));
    return (id: string | null | undefined) => (id ? (map.get(id) ?? '—') : '—');
  }, [lookups]);

  const stockByItem = useMemo(() => new Map((stock ?? []).map((s) => [s.itemId, s])), [stock]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items ?? [];
    return (items ?? []).filter((i) =>
      `${i.artikul ?? ''} ${i.kod ?? ''} ${i.name}`.toLowerCase().includes(q),
    );
  }, [items, search]);

  async function handleDelete(item: SkladItem) {
    if (!window.confirm(t('sklad.item.deleteConfirm'))) return;
    setErrorMessage(null);
    try {
      await deleteItem.mutateAsync({ orgId, itemId: item.id });
    } catch (err) {
      const code = (err as { code?: string }).code;
      setErrorMessage(code === FK_VIOLATION ? t('sklad.item.deleteInUse') : (err as Error).message);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{t('sklad.settings.itemsDescription')}</p>
        <Button
          type="button"
          onClick={() => {
            setEditingItem(null);
            setFormOpen(true);
          }}
        >
          {t('sklad.addItem')}
        </Button>
      </div>

      <Card className="p-4">
        <Input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('sklad.searchPlaceholder')}
          className="max-w-sm"
        />

        {errorMessage && <p className="mt-3 text-sm text-rose-600">{errorMessage}</p>}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-1.5 pr-3 font-medium">{t('sklad.item.artikulLabel')}</th>
                <th className="py-1.5 pr-3 font-medium">{t('sklad.item.kodLabel')}</th>
                <th className="py-1.5 pr-3 font-medium">{t('sklad.item.nameLabel')}</th>
                <th className="py-1.5 pr-3 font-medium">{t('sklad.item.productTypeLabel')}</th>
                <th className="py-1.5 pr-3 text-right font-medium">{t('sklad.item.gsmLabel')}</th>
                <th className="py-1.5 pr-3 font-medium">{t('sklad.item.sizeLabel')}</th>
                <th className="py-1.5 pr-3 font-medium">{t('sklad.item.colorLabel')}</th>
                <th className="py-1.5 pr-3 text-right font-medium">{t('sklad.stock.dona')}</th>
                <th className="py-1.5 pr-3 text-right font-medium">{t('sklad.stock.kg')}</th>
                {isOrgAdmin && (
                  <th className="py-1.5 pr-3 text-right font-medium">{t('sklad.stock.value')}</th>
                )}
                <th className="py-1.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => {
                const s = stockByItem.get(i.id);
                return (
                  <tr key={i.id} className="border-b border-slate-100">
                    <td className="py-1.5 pr-3">{i.artikul ?? '—'}</td>
                    <td className="py-1.5 pr-3 text-slate-500">{i.kod ?? '—'}</td>
                    <td className="py-1.5 pr-3">{i.name}</td>
                    <td className="py-1.5 pr-3">{lookupName(i.productTypeId)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{i.gsm ?? '—'}</td>
                    <td className="py-1.5 pr-3">{lookupName(i.sizeId)}</td>
                    <td className="py-1.5 pr-3">{lookupName(i.colorId)}</td>
                    <td className="py-1.5 pr-3 text-right font-medium tabular-nums">
                      {s ? qtyFormat.format(s.totalDona) : '0'}
                    </td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">
                      {s ? kgFormat.format(s.totalKg) : '0'}
                    </td>
                    {isOrgAdmin && (
                      <td className="py-1.5 pr-3 text-right tabular-nums">
                        {s?.stockValue != null ? moneyFormat.format(s.stockValue) : '—'}
                      </td>
                    )}
                    <td className="py-1.5 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingItem(i);
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
                            onClick={() => void handleDelete(i)}
                          >
                            {t('common.delete')}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-500">{t('sklad.item.empty')}</p>
          )}
        </div>
      </Card>

      {formOpen && (
        <ItemForm
          orgId={orgId}
          item={editingItem}
          onClose={() => {
            setFormOpen(false);
            setEditingItem(null);
          }}
        />
      )}
    </div>
  );
}
