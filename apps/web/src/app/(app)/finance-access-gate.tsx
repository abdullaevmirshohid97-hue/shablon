'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
      className={`${className} flex items-center justify-center rounded-full bg-brand-100 text-lg font-semibold text-brand-700`}
    >
      {initial}
    </span>
  );
}

/**
 * Whoever is already signed into the browser (from /login, or a previous
 * pick here) isn't necessarily who's about to use Finance on a shared
 * device — this screen has each employee find their own photo+name tile and
 * re-confirm with their own password. That's a real signInWithPassword, not
 * a shared PIN, so the session — and everything logged afterward — is
 * genuinely theirs, not whoever last used the device.
 */
export function FinanceAccessGate({
  orgId,
  children,
}: {
  orgId: string | null;
  children: React.ReactNode;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const [unlocked, setUnlocked] = useState(() => (orgId ? isUnlocked(orgId) : false));
  const [roster, setRoster] = useState<RosterEntry[] | null>(null);
  const [selected, setSelected] = useState<RosterEntry | null>(null);
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'checking' | 'wrong'>('idle');

  useEffect(() => {
    if (!orgId || unlocked) return;
    const supabase = createSupabaseBrowserClient();
    supabase.rpc('list_org_roster', { target_org_id: orgId }).then(({ data }) => {
      setRoster(data ?? []);
    });
  }, [orgId, unlocked]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId || !selected?.email) return;
    setStatus('checking');

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: selected.email,
      password,
    });
    setPassword('');

    if (error) {
      setStatus('wrong');
      return;
    }

    sessionStorage.setItem(STORAGE_PREFIX + orgId, '1');
    setUnlocked(true);
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
              onClick={() => {
                setSelected(null);
                setStatus('idle');
              }}
              className="mb-3 text-sm text-slate-500 hover:text-slate-700"
            >
              ← {t('nav.back')}
            </button>
            <div className="mb-4 flex items-center gap-3">
              <RosterAvatar entry={selected} className="h-12 w-12" />
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900">
                  {selected.full_name ?? selected.email}
                </p>
                <p className="truncate text-xs text-slate-400">{selected.email}</p>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <p className="text-sm text-slate-500">{t('financeAccess.passwordPrompt')}</p>
              <Input
                type="password"
                autoFocus
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setStatus('idle');
                }}
                placeholder={t('financeAccess.passwordPlaceholder')}
              />
              {status === 'wrong' && (
                <p className="text-sm text-rose-600">{t('financeAccess.incorrect')}</p>
              )}
              <Button type="submit" disabled={status === 'checking' || !password}>
                {status === 'checking' ? t('financeAccess.verifying') : t('financeAccess.submit')}
              </Button>
            </form>
          </>
        ) : (
          <>
            <h1 className="mb-4 text-lg font-semibold text-slate-900">
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
                  <span className="w-full truncate text-xs font-medium text-slate-700">
                    {entry.full_name ?? entry.email}
                  </span>
                </button>
              ))}
            </div>
            {roster?.length === 0 && (
              <p className="text-sm text-slate-500">{t('financeAccess.empty')}</p>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
