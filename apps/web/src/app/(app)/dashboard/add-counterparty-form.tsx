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

/**
 * `collapsible` puts the whole thing behind its own button.
 *
 * The client directory is a list people come to read, and a permanently open
 * form above it made the first thing on the page an empty form for a client
 * nobody is adding — three fields and a category picker standing between the
 * heading and the list every single visit. Adding a client is occasional; the
 * list is the page. So the form waits behind the button that names it.
 *
 * Off by default, so the module pages that open straight into "add a client
 * tagged with this module" keep behaving as they do.
 */
export function AddCounterpartyForm({
  orgId,
  presetCategory,
  collapsible = false,
}: {
  orgId: string;
  presetCategory?: string;
  collapsible?: boolean;
}) {
  const router = useRouter();
  const { t } = useLocale();
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const { data: modules } = useModules(supabase, orgId);
  const createModule = useCreateModule(supabase);

  const [open, setOpen] = useState(false);
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
    // The client is in the list now; leaving the form open invites a second
    // one nobody meant to add.
    setOpen(false);
    router.refresh();
  }

  if (collapsible && !open) {
    return (
      <Button type="button" onClick={() => setOpen(true)}>
        {t('addCounterparty.submit')}
      </Button>
    );
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
                  className="rounded-full border border-slate-300 px-3 py-1 text-fin-md focus:border-brand-500"
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
          {collapsible && (
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
          )}
          {errorMessage && <p className="text-fin-md text-rose-600">{errorMessage}</p>}
        </div>
      </form>
    </Card>
  );
}
