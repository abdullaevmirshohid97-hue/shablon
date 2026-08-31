'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import type { OrgOption } from '@/lib/auth/activeOrg';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

/** The code this door opens with until someone sets a real one. */
export const INITIAL_DIRECTOR_PIN = '0000';

/**
 * The director's door.
 *
 * The same kind of lock the modules use and for the same reason: whoever is
 * signed into the browser is not necessarily who is about to read the whole
 * group's books on a shared screen. What it is not is a way in — everything
 * behind it is data this account already has rights to under RLS, in
 * organizations it is already an owner or admin of. The code confirms the
 * person at the keyboard; it grants nothing.
 *
 * That is also why 0000 is safe as the starting code and would not be if this
 * screen reached other people's businesses. It does not: it reaches yours.
 *
 * The PIN itself is never read here. `verify_finance_pin` does the comparison
 * in Postgres against the caller's own membership, so the hash never leaves
 * the database — and one code works at every door, which is the rule 0020 set.
 */
export function DirectorGate({ orgs, children }: { orgs: OrgOption[]; children: React.ReactNode }) {
  const { t } = useLocale();
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPin, setHasPin] = useState<boolean | null>(null);

  // Whether a code has ever been set — read from this account's own rows and
  // reduced to a yes/no immediately. Nothing else is done with it.
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    void supabase.auth.getUser().then(({ data }) => {
      const userId = data.user?.id;
      if (!userId) return;
      void supabase
        .from('memberships')
        .select('finance_pin_hash')
        .eq('user_id', userId)
        .then(({ data: rows }) => {
          setHasPin((rows ?? []).some((r) => Boolean(r.finance_pin_hash)));
        });
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setChecking(true);

    try {
      const supabase = createSupabaseBrowserClient();

      // Any of their organizations: one person, one code, whichever door.
      const results = await Promise.all(
        orgs.map((org) => supabase.rpc('verify_finance_pin', { target_org_id: org.orgId, pin })),
      );

      if (results.some((r) => r.data === true)) {
        setUnlocked(true);
        return;
      }

      // No code set anywhere yet: the initial one lets them in, and the
      // settings screen asks them to replace it straight away.
      if (hasPin === false && pin === INITIAL_DIRECTOR_PIN) {
        setUnlocked(true);
        return;
      }

      setError(t('director.wrongPin'));
      setPin('');
    } finally {
      setChecking(false);
    }
  }

  if (unlocked) return <>{children}</>;

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <Card className="w-full max-w-sm p-6">
        <h1 className="text-fin-xl font-semibold text-slate-900">{t('director.title')}</h1>
        <p className="mt-1 text-fin-md text-slate-500">{t('director.gateHint')}</p>

        <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
          <Input
            type="password"
            inputMode="numeric"
            autoFocus
            autoComplete="off"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder={t('director.pinPlaceholder')}
            aria-label={t('director.pinLabel')}
          />

          {error && <p className="text-fin-md text-rose-600">{error}</p>}

          {hasPin === false && (
            <p className="text-fin-sm text-amber-700">
              {t('director.initialPinNotice').replace('{pin}', INITIAL_DIRECTOR_PIN)}
            </p>
          )}

          <Button type="submit" disabled={checking || pin.length < 4}>
            {checking ? t('common.loading') : t('director.unlock')}
          </Button>
        </form>

        <p className="mt-4 text-fin-xs leading-snug text-slate-400">
          {t('director.scopeNote').replace('{n}', String(orgs.length))}
        </p>
      </Card>
    </div>
  );
}
