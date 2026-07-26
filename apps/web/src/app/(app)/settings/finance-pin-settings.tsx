'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Card } from '@/components/ui/Card';
import { Input, Label } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export function FinancePinSettings({ orgId }: { orgId: string }) {
  const { t } = useLocale();
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.rpc('has_finance_pin', { target_org_id: orgId }).then(({ data }) => {
      setHasPin(Boolean(data));
    });
  }, [orgId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setSavedMessage(false);

    if (!/^[0-9]{4,8}$/.test(newPin)) {
      setErrorMessage(t('settingsFinancePin.invalid'));
      return;
    }
    if (newPin !== confirmPin) {
      setErrorMessage(t('settingsFinancePin.mismatch'));
      return;
    }

    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.rpc('set_finance_pin', { target_org_id: orgId, pin: newPin });
    setSaving(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setHasPin(true);
    setNewPin('');
    setConfirmPin('');
    setSavedMessage(true);
  }

  return (
    <Card className="p-4">
      <h2 className="text-base font-semibold text-slate-900">{t('settingsFinancePin.title')}</h2>
      <p className="mt-1 text-sm text-slate-500">{t('settingsFinancePin.description')}</p>

      {hasPin !== null && (
        <p className={`mt-2 text-xs font-medium ${hasPin ? 'text-emerald-600' : 'text-amber-600'}`}>
          {hasPin ? t('settingsFinancePin.statusSet') : t('settingsFinancePin.statusNotSet')}
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3 sm:max-w-xs">
        <div>
          <Label>{t('settingsFinancePin.newLabel')}</Label>
          <Input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            minLength={4}
            maxLength={8}
            value={newPin}
            onChange={(e) => setNewPin(e.target.value)}
          />
        </div>
        <div>
          <Label>{t('settingsFinancePin.confirmLabel')}</Label>
          <Input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            minLength={4}
            maxLength={8}
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={saving || !newPin || !confirmPin} className="w-fit">
          {t('settingsFinancePin.save')}
        </Button>
        {errorMessage && <p className="text-sm text-rose-600">{errorMessage}</p>}
        {savedMessage && (
          <p className="text-sm text-emerald-600">{t('settingsFinancePin.saved')}</p>
        )}
      </form>
    </Card>
  );
}
