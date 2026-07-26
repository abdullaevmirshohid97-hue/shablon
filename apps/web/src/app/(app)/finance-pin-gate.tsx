'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

const STORAGE_PREFIX = 'mubosher.financeUnlocked.';

function isUnlocked(orgId: string): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(STORAGE_PREFIX + orgId) === '1';
}

/**
 * Each employee has their own PIN on their membership row (0008_finance_pin.sql) —
 * this only unlocks Finance for the current browser tab's session, so leaving
 * the tab (or an incognito/shared-device session) re-prompts. It never
 * replaces the org-wide Supabase Auth login; it's a second, personal gate on
 * top of it so employees don't end up acting under each other's session.
 */
export function FinancePinGate({
  orgId,
  children,
}: {
  orgId: string | null;
  children: React.ReactNode;
}) {
  const { t } = useLocale();
  const [unlocked, setUnlocked] = useState(() => (orgId ? isUnlocked(orgId) : false));
  const [pin, setPin] = useState('');
  const [status, setStatus] = useState<'idle' | 'checking' | 'wrong' | 'not-set'>('idle');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId) return;
    setStatus('checking');

    const supabase = createSupabaseBrowserClient();
    const { data: hasPin } = await supabase.rpc('has_finance_pin', { target_org_id: orgId });
    if (!hasPin) {
      setStatus('not-set');
      return;
    }

    const { data: ok } = await supabase.rpc('verify_finance_pin', { target_org_id: orgId, pin });
    setPin('');
    if (ok) {
      sessionStorage.setItem(STORAGE_PREFIX + orgId, '1');
      setUnlocked(true);
    } else {
      setStatus('wrong');
    }
  }

  if (!orgId || unlocked) return <>{children}</>;

  return (
    <div className="flex min-h-[calc(100vh-57px)] items-center justify-center px-4">
      <Card className="w-full max-w-sm p-6">
        <h1 className="text-lg font-semibold text-slate-900">{t('financePin.enterTitle')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('financePin.enterPrompt')}</p>

        {status === 'not-set' ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-rose-600">{t('financePin.notSetMessage')}</p>
            <Link href="/settings">
              <Button type="button" className="w-full">
                {t('financePin.goToSettings')}
              </Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
            <Input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              required
              minLength={4}
              maxLength={8}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setStatus('idle');
              }}
              placeholder={t('financePin.placeholder')}
            />
            {status === 'wrong' && (
              <p className="text-sm text-rose-600">{t('financePin.incorrect')}</p>
            )}
            <Button type="submit" disabled={status === 'checking' || pin.length < 4}>
              {status === 'checking' ? t('financePin.verifying') : t('financePin.submit')}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
