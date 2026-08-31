'use client';

import { useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import type { OrgOption } from '@/lib/auth/activeOrg';
import { Card } from '@/components/ui/Card';
import { Input, Label } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { INITIAL_DIRECTOR_PIN } from './director-gate';

/**
 * Changing the code that opens this door — and every other one.
 *
 * There is one PIN per person, not one per module (0020), so it is written to
 * every organization the account belongs to rather than to whichever happened
 * to be active. A code that worked at the director's door and not at the
 * ledger's would be a second code to remember and a support call waiting.
 *
 * `set_finance_pin` runs as SECURITY DEFINER hard-scoped to auth.uid(), so
 * this can only ever change the caller's own code — including for an owner,
 * who sets other people's through a different function on a different screen.
 */
export function DirectorPinSettings({ orgs }: { orgs: OrgOption[] }) {
  const { t } = useLocale();
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tooShort = pin.length < 4 || pin.length > 10;
  const mismatch = confirm.length > 0 && pin !== confirm;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    if (tooShort) return setError(t('director.pinLength'));
    if (pin !== confirm) return setError(t('director.pinMismatch'));
    if (pin === INITIAL_DIRECTOR_PIN) return setError(t('director.pinTooObvious'));

    setSaving(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const results = await Promise.all(
        orgs.map((org) => supabase.rpc('set_finance_pin', { target_org_id: org.orgId, pin })),
      );

      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;

      setSaved(true);
      setPin('');
      setConfirm('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="max-w-md p-4">
      <h2 className="text-fin-lg font-semibold text-slate-900">{t('director.pinTitle')}</h2>
      <p className="mt-1 text-fin-md text-slate-500">
        {t('director.pinHint').replace('{n}', String(orgs.length))}
      </p>

      <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
        <div>
          <Label>{t('director.newPin')}</Label>
          <Input
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
          />
        </div>
        <div>
          <Label>{t('director.repeatPin')}</Label>
          <Input
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {mismatch && (
            <p className="mt-1 text-fin-sm text-rose-600">{t('director.pinMismatch')}</p>
          )}
        </div>

        {error && <p className="text-fin-md text-rose-600">{error}</p>}
        {saved && <p className="text-fin-md text-emerald-700">{t('director.pinSaved')}</p>}

        <div>
          <Button type="submit" disabled={saving || tooShort || mismatch || !confirm}>
            {saving ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      </form>

      <p className="mt-4 border-t border-slate-100 pt-3 text-fin-xs leading-snug text-slate-400">
        {t('director.pinNote')}
      </p>
    </Card>
  );
}
