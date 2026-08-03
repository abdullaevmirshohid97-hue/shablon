'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';

/**
 * The organisation name is the one label the whole finance app renders back at
 * the user — sidebar footer, report headings, the PDF/Excel export subtitle,
 * and the mobile app. Every one of those reads `organizations.name`, so this
 * single field renames all of them; the slug is left alone because it is an
 * admin-facing identifier, not a display name.
 */
export function OrganizationSettings({
  orgId,
  initialName,
}: {
  orgId: string;
  initialName: string;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const [supabase] = useState(() => createSupabaseBrowserClient());

  const [name, setName] = useState(initialName);
  // What the database holds, tracked locally so Save greys out the moment the
  // write lands instead of waiting for router.refresh() to bring the prop back.
  const [savedName, setSavedName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const trimmed = name.trim();
  const dirty = trimmed !== savedName;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!trimmed || !dirty) return;

    setErrorMessage(null);
    setSaved(false);
    setSaving(true);

    // Selecting the row back distinguishes "saved" from "RLS matched nothing":
    // an update that touches zero rows comes back without an error.
    const { data, error } = await supabase
      .from('organizations')
      .update({ name: trimmed })
      .eq('id', orgId)
      .select('name')
      .maybeSingle();

    setSaving(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    if (!data) {
      setErrorMessage(t('settings.orgNameDenied'));
      return;
    }

    setName(data.name);
    setSavedName(data.name);
    setSaved(true);
    router.refresh();
  }

  return (
    <Card className="p-4">
      <h2 className="text-base font-semibold text-slate-900">{t('settings.orgTitle')}</h2>
      <p className="mt-1 text-sm text-slate-500">{t('settings.orgDescription')}</p>

      <form onSubmit={handleSave} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Label>{t('settings.orgNameLabel')}</Label>
          <Input
            type="text"
            required
            maxLength={80}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSaved(false);
            }}
            placeholder={t('settings.orgNamePlaceholder')}
          />
        </div>
        <Button type="submit" disabled={saving || !trimmed || !dirty}>
          {saving ? t('common.saving') : t('common.save')}
        </Button>
      </form>

      {errorMessage && <p className="mt-2 text-sm text-rose-600">{errorMessage}</p>}
      {saved && !errorMessage && (
        <p className="mt-2 text-sm text-emerald-700">{t('settings.orgNameSaved')}</p>
      )}
    </Card>
  );
}
