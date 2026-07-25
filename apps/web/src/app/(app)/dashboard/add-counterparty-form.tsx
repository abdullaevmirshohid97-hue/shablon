'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useModules, useCreateModule } from '@mubosher/api-client';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Card } from '@/components/ui/Card';
import { Input, Label } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ToggleChip } from '@/components/ui/Badge';

export function AddCounterpartyForm({
  orgId,
  presetCategory,
}: {
  orgId: string;
  presetCategory?: string;
}) {
  const router = useRouter();
  const { t } = useLocale();
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const { data: modules } = useModules(supabase, orgId);
  const createModule = useCreateModule(supabase);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [categories, setCategories] = useState<string[]>(presetCategory ? [presetCategory] : []);
  const [customCategory, setCustomCategory] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function toggleCategory(label: string) {
    setCategories((prev) =>
      prev.includes(label) ? prev.filter((c) => c !== label) : [...prev, label],
    );
  }

  async function addCustomCategory() {
    setErrorMessage(null);
    const value = customCategory.trim();
    if (!value || categories.includes(value)) {
      setCustomCategory('');
      return;
    }

    // Any category typed here becomes a real module too, so it shows up in
    // the sidebar exactly like one created from Settings — refresh right
    // away rather than waiting for the counterparty form submit.
    if (!modules?.some((m) => m.name === value)) {
      try {
        await createModule.mutateAsync({ orgId, name: value });
        router.refresh();
      } catch (err) {
        setErrorMessage((err as Error).message);
        setCustomCategory('');
        return;
      }
    }

    setCategories((prev) => [...prev, value]);
    setCustomCategory('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('saving');
    setErrorMessage(null);

    const { error } = await supabase.from('counterparties').insert({
      org_id: orgId,
      name: name.trim(),
      phone: phone.trim() || null,
      categories,
    });

    if (error) {
      setStatus('error');
      setErrorMessage(error.message);
      return;
    }

    setName('');
    setPhone('');
    setCategories(presetCategory ? [presetCategory] : []);
    setStatus('idle');
    router.refresh();
  }

  return (
    <Card className="p-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <Label>{t('addCounterparty.nameLabel')}</Label>
            <Input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('addCounterparty.namePlaceholder')}
            />
          </div>
          <div className="flex-1">
            <Label>{t('addCounterparty.phoneLabel')}</Label>
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t('addCounterparty.phonePlaceholder')}
            />
          </div>
        </div>

        {/* Modul sahifasida kategoriya moduldan avtomatik belgilanadi, shuning
            uchun tanlagichni ko'rsatmaymiz. Faqat umumiy "Mijozlar" sahifasida
            (presetCategory yo'q) chiqadi. */}
        {!presetCategory && (
          <div>
            <Label>{t('addCounterparty.categoriesLabel')}</Label>
            <div className="flex flex-wrap items-center gap-1.5">
              {(modules ?? []).map((m) => (
                <ToggleChip
                  key={m.id}
                  active={categories.includes(m.name)}
                  onClick={() => toggleCategory(m.name)}
                >
                  {m.name}
                </ToggleChip>
              ))}
              {categories
                .filter((c) => !modules?.some((m) => m.name === c))
                .map((c) => (
                  <ToggleChip key={c} active onClick={() => toggleCategory(c)}>
                    {c} ×
                  </ToggleChip>
                ))}
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void addCustomCategory();
                    }
                  }}
                  placeholder={t('addCounterparty.addCategoryPlaceholder')}
                  className="rounded-full border border-slate-300 px-3 py-1 text-sm focus:border-brand-500"
                />
                <Button type="button" variant="ghost" size="sm" onClick={() => addCustomCategory()}>
                  {t('addCounterparty.addCategoryButton')}
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={status === 'saving'}>
            {status === 'saving' ? t('common.saving') : t('addCounterparty.submit')}
          </Button>
          {errorMessage && <p className="text-sm text-rose-600">{errorMessage}</p>}
        </div>
      </form>
    </Card>
  );
}
