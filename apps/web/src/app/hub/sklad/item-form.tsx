'use client';

import { useState } from 'react';
import { useCreateSkladItem, useUpdateSkladItem, useSkladLookups } from '@mubosher/api-client';
import type { SkladItem } from '@mubosher/shared';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Input, Label, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export function ItemForm({
  orgId,
  item,
  onClose,
}: {
  orgId: string;
  item?: SkladItem | null;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const { data: lookups } = useSkladLookups(supabase, orgId);
  const createItem = useCreateSkladItem(supabase);
  const updateItem = useUpdateSkladItem(supabase);

  const [artikul, setArtikul] = useState(item?.artikul ?? '');
  const [kod, setKod] = useState(item?.kod ?? '');
  const [name, setName] = useState(item?.name ?? '');
  const [gsm, setGsm] = useState(item?.gsm != null ? String(item.gsm) : '');
  const [productTypeId, setProductTypeId] = useState(item?.productTypeId ?? '');
  const [yarnTypeId, setYarnTypeId] = useState(item?.yarnTypeId ?? '');
  const [sizeId, setSizeId] = useState(item?.sizeId ?? '');
  const [sortId, setSortId] = useState(item?.sortId ?? '');
  const [colorId, setColorId] = useState(item?.colorId ?? '');
  const [pantoneId, setPantoneId] = useState(item?.pantoneId ?? '');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const saving = createItem.isPending || updateItem.isPending;

  function optionsFor(kind: string) {
    return (lookups ?? []).filter((l) => l.kind === kind);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    const input = {
      orgId,
      artikul: artikul || null,
      kod: kod || null,
      name: name.trim(),
      productTypeId: productTypeId || null,
      yarnTypeId: yarnTypeId || null,
      gsm: gsm ? Number(gsm) : null,
      sizeId: sizeId || null,
      sortId: sortId || null,
      colorId: colorId || null,
      pantoneId: pantoneId || null,
    };

    try {
      if (item) {
        await updateItem.mutateAsync({ itemId: item.id, ...input });
      } else {
        await createItem.mutateAsync(input);
      }
      onClose();
    } catch (err) {
      setErrorMessage((err as Error).message);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-popover">
        <h2 className="mb-4 text-base font-semibold text-slate-900">{t('sklad.item.title')}</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('sklad.item.artikulLabel')}</Label>
              <Input type="text" value={artikul} onChange={(e) => setArtikul(e.target.value)} />
            </div>
            <div>
              <Label>{t('sklad.item.kodLabel')}</Label>
              <Input type="text" value={kod} onChange={(e) => setKod(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>{t('sklad.item.nameLabel')}</Label>
            <Input type="text" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('sklad.item.productTypeLabel')}</Label>
              <Select value={productTypeId} onChange={(e) => setProductTypeId(e.target.value)}>
                <option value=""></option>
                {optionsFor('mahsulot_turi').map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>{t('sklad.item.yarnTypeLabel')}</Label>
              <Select value={yarnTypeId} onChange={(e) => setYarnTypeId(e.target.value)}>
                <option value=""></option>
                {optionsFor('ip_turi').map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>{t('sklad.item.gsmLabel')}</Label>
              <Input type="number" value={gsm} onChange={(e) => setGsm(e.target.value)} />
            </div>
            <div>
              <Label>{t('sklad.item.sizeLabel')}</Label>
              <Select value={sizeId} onChange={(e) => setSizeId(e.target.value)}>
                <option value=""></option>
                {optionsFor('olcham').map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>{t('sklad.item.sortLabel')}</Label>
              <Select value={sortId} onChange={(e) => setSortId(e.target.value)}>
                <option value=""></option>
                {optionsFor('sort').map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>{t('sklad.item.colorLabel')}</Label>
              <Select value={colorId} onChange={(e) => setColorId(e.target.value)}>
                <option value=""></option>
                {optionsFor('rang').map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>{t('sklad.item.pantoneLabel')}</Label>
              <Select value={pantoneId} onChange={(e) => setPantoneId(e.target.value)}>
                <option value=""></option>
                {optionsFor('pantone').map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {errorMessage && <p className="text-sm text-rose-600">{errorMessage}</p>}

          <div className="mt-1 flex gap-2">
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? t('sklad.item.saving') : t('sklad.item.save')}
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
