'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

type RosterEntry = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
};

function RosterAvatar({ entry, className }: { entry: RosterEntry; className: string }) {
  if (entry.avatar_url) {
    return (
      <img src={entry.avatar_url} alt="" className={`${className} rounded-full object-cover`} />
    );
  }
  const initial = (entry.full_name ?? entry.email ?? '?').trim().charAt(0).toUpperCase();
  return (
    <span
      className={`${className} flex items-center justify-center rounded-full bg-brand-100 text-fin-xl font-semibold text-brand-700`}
    >
      {initial}
    </span>
  );
}

/**
 * Finance sits behind a second lock, because whoever is signed into the
 * browser is not necessarily who is about to type into the ledger on a shared
 * screen. Each employee finds their own tile and confirms.
 *
 * What they confirm with depends on who they picked:
 *
 *   - themselves, with a PIN issued by the admin → the short code. It only
 *     re-confirms the session they already hold, so it is allowed to be short.
 *   - anyone else → that person's real login password, which switches the
 *     Supabase session to them. A PIN cannot do this, and letting it appear
 *     to would mean their entries get written to the audit log under the
 *     previous person's name.
 *
 * The unlock is React state and nothing else — no sessionStorage — so the PIN
 * is asked again on every fresh load of the app rather than once per tab.
 */
export function FinanceAccessGate({
  orgId,
  currentUserId,
  children,
}: {
  orgId: string | null;
  currentUserId: string | null;
  children: React.ReactNode;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const [unlocked, setUnlocked] = useState(false);
  const [roster, setRoster] = useState<RosterEntry[] | null>(null);
  const [hasPin, setHasPin] = useState(false);
  const [selected, setSelected] = useState<RosterEntry | null>(null);
  const [secret, setSecret] = useState('');
  const [status, setStatus] = useState<'idle' | 'checking' | 'wrong'>('idle');

  useEffect(() => {
    if (!orgId || unlocked) return;
    const supabase = createSupabaseBrowserClient();
    void Promise.all([
      supabase.rpc('list_org_roster', { target_org_id: orgId }),
      supabase.rpc('has_finance_pin', { target_org_id: orgId }),
    ]).then(([rosterResult, pinResult]) => {
      setRoster(rosterResult.data ?? []);
      setHasPin(pinResult.data === true);
    });
  }, [orgId, unlocked]);

  // Only the signed-in user's own PIN can be checked — verify_finance_pin has
  // no target_user_id, it reads auth.uid()'s membership row and nothing else.
  const usePin = selected != null && selected.user_id === currentUserId && hasPin;

  function reset() {
    setSelected(null);
    setSecret('');
    setStatus('idle');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId || !selected) return;
    setStatus('checking');
    const supabase = createSupabaseBrowserClient();

    if (usePin) {
      const { data, error } = await supabase.rpc('verify_finance_pin', {
        target_org_id: orgId,
        pin: secret,
      });
      setSecret('');
      if (error || data !== true) {
        setStatus('wrong');
        return;
      }
      setUnlocked(true);
      return;
    }

    if (!selected.email) {
      setStatus('wrong');
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: selected.email,
      password: secret,
    });
    setSecret('');
    if (error) {
      setStatus('wrong');
      return;
    }
    setUnlocked(true);
    // The session now belongs to whoever was picked; re-render the server
    // tree so their role, name and permissions replace the previous user's.
    router.refresh();
  }

  if (!orgId || unlocked) return <>{children}</>;

  return (
    <div className="flex min-h-[calc(100vh-57px)] items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md p-6">
        {selected ? (
          <>
            <button
              type="button"
              onClick={reset}
              className="mb-3 text-fin-md text-slate-500 hover:text-slate-700"
            >
              ← {t('nav.back')}
            </button>
            <div className="mb-4 flex items-center gap-3">
              <RosterAvatar entry={selected} className="h-12 w-12" />
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900">
                  {selected.full_name ?? selected.email}
                </p>
                <p className="truncate text-fin-sm text-slate-400">{selected.email}</p>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <p className="text-fin-md text-slate-500">
                {t(usePin ? 'financeAccess.pinPrompt' : 'financeAccess.passwordPrompt')}
              </p>
              <Input
                type="password"
                autoFocus
                required
                minLength={usePin ? 4 : undefined}
                maxLength={usePin ? 10 : undefined}
                autoComplete={usePin ? 'off' : 'current-password'}
                className={usePin ? 'text-center text-fin-xl tracking-[0.4em]' : undefined}
                value={secret}
                onChange={(e) => {
                  setSecret(e.target.value);
                  setStatus('idle');
                }}
                placeholder={t(
                  usePin ? 'financeAccess.pinPlaceholder' : 'financeAccess.passwordPlaceholder',
                )}
              />
              {/* Picking a colleague is a real sign-in, not a peek — say so
                  before they wonder why the short code stopped working. */}
              {!usePin && selected.user_id !== currentUserId && (
                <p className="text-fin-sm text-slate-400">{t('financeAccess.otherPersonHint')}</p>
              )}
              {status === 'wrong' && (
                <p className="text-fin-md text-rose-600">
                  {t(usePin ? 'financeAccess.pinIncorrect' : 'financeAccess.incorrect')}
                </p>
              )}
              <Button type="submit" disabled={status === 'checking' || !secret}>
                {status === 'checking' ? t('financeAccess.verifying') : t('financeAccess.submit')}
              </Button>
            </form>
          </>
        ) : (
          <>
            <h1 className="mb-4 text-fin-xl font-semibold text-slate-900">
              {t('financeAccess.pickPrompt')}
            </h1>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {roster?.map((entry) => (
                <button
                  key={entry.user_id}
                  type="button"
                  onClick={() => setSelected(entry)}
                  className="flex flex-col items-center gap-1.5 rounded-lg p-2 text-center hover:bg-slate-50"
                >
                  <RosterAvatar entry={entry} className="h-14 w-14" />
                  <span className="w-full truncate text-fin-sm font-medium text-slate-700">
                    {entry.full_name ?? entry.email}
                  </span>
                </button>
              ))}
            </div>
            {roster?.length === 0 && (
              <p className="text-fin-md text-slate-500">{t('financeAccess.empty')}</p>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
