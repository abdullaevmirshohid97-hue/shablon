'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Input, Label } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { PwaInstall } from '@/components/PwaInstall';

/**
 * Full-bleed split: brand panel left, form right. The shared Header is
 * suppressed on this route (see Header.tsx) so nothing sits above the split
 * — which also means the locale switch has to live here.
 *
 * The panel is near-black rather than coloured, same rule as the rest of the
 * app: chrome is graphite, and only an amount is allowed to carry a hue.
 * Below `lg` the panel collapses to a compact header so a phone gets the form
 * above the fold instead of a screen of decoration.
 */
export default function LoginPage() {
  const router = useRouter();
  const { t, locale, setLocale } = useLocale();
  const [mode, setMode] = useState<'password' | 'magic-link'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // A session already in the browser no longer skips this screen (see
  // app/page.tsx) — it is surfaced here instead, so it is a visible choice
  // rather than an invisible one.
  const [signedInAs, setSignedInAs] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    void supabase.auth.getUser().then(({ data }) => {
      setSignedInAs(data.user?.email ?? null);
    });
  }, []);

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    setSignedInAs(null);
    router.refresh();
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    setErrorMessage(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setStatus('error');
      setErrorMessage(error.message);
      return;
    }
    router.push('/hub');
    router.refresh();
  }

  async function handleMagicLinkSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    setErrorMessage(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/hub` },
    });
    if (error) {
      setStatus('error');
      setErrorMessage(error.message);
      return;
    }
    setStatus('sent');
  }

  return (
    <main className="flex min-h-screen flex-col lg:flex-row">
      {/* ---------- Brend paneli ---------- */}
      <section className="relative flex shrink-0 flex-col justify-between overflow-hidden bg-slate-900 px-6 py-6 text-white lg:w-[44%] lg:px-12 lg:py-10">
        {/* Ohang uchun juda past kontrastli nur — panel tekis qora bo'lib
            qolmasligi uchun, lekin matnga xalaqit bermaydi. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/[0.04] blur-2xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-white/[0.03] blur-2xl"
        />

        <div className="relative flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-base font-bold text-slate-900">
            M
          </span>
          <span className="text-base font-semibold tracking-tight">{t('header.brand')}</span>
        </div>

        <div className="relative mt-8 hidden lg:block">
          <h2 className="max-w-md text-3xl font-semibold leading-tight tracking-tightest">
            {t('login.heroTitle')}
          </h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-400">
            {t('login.heroSubtitle')}
          </p>

          <ul className="mt-8 flex flex-col gap-2.5">
            {['login.heroPoint1', 'login.heroPoint2', 'login.heroPoint3'].map((key) => (
              <li key={key} className="flex items-start gap-2.5 text-sm text-slate-300">
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="mt-0.5 h-4 w-4 shrink-0 text-slate-500"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.704 5.29a1 1 0 010 1.415l-7.5 7.5a1 1 0 01-1.415 0l-3.5-3.5a1 1 0 111.415-1.414L8.5 12.086l6.79-6.795a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                {t(key)}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative mt-6 hidden text-xs text-slate-500 lg:block">
          © {new Date().getFullYear()} {t('header.brand')}
        </p>
      </section>

      {/* ---------- Forma ---------- */}
      <section className="flex flex-1 items-center justify-center bg-slate-50 px-4 py-10 sm:px-6">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                {t('login.title')}
              </h1>
              <p className="mt-1 text-sm text-slate-500">{t('login.subtitle')}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <Segmented
                value={locale}
                onChange={setLocale}
                options={[
                  { value: 'uz', label: 'UZ' },
                  { value: 'ru', label: 'RU' },
                ]}
              />
              {/* Here as well as in the header: this is where a new user lands,
                  and it is the one screen they see before deciding whether the
                  thing is worth keeping on their phone. */}
              <PwaInstall />
            </div>
          </div>

          {signedInAs && (
            <div className="mb-4 rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-sm text-slate-600">
                {t('login.alreadySignedIn')}{' '}
                <span className="font-medium text-slate-900">{signedInAs}</span>
              </p>
              <div className="mt-2.5 flex items-center gap-2">
                <Button type="button" size="sm" onClick={() => router.push('/hub')}>
                  {t('login.continueButton')}
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={handleSignOut}>
                  {t('login.switchAccount')}
                </Button>
              </div>
            </div>
          )}

          <Segmented
            value={mode}
            onChange={(next) => {
              setMode(next);
              setStatus('idle');
              setErrorMessage(null);
            }}
            options={[
              { value: 'password', label: t('login.tabPassword') },
              { value: 'magic-link', label: t('login.tabMagicLink') },
            ]}
          />

          {mode === 'password' ? (
            <form onSubmit={handlePasswordSubmit} className="mt-5 flex flex-col gap-3.5">
              <div>
                <Label>{t('login.emailLabel')}</Label>
                <Input
                  type="email"
                  required
                  autoComplete="username"
                  placeholder={t('login.emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <Label>{t('login.passwordPlaceholder')}</Label>
                <Input
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder={t('login.passwordPlaceholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={status === 'sending'} className="mt-1 w-full">
                {status === 'sending' ? t('login.signingIn') : t('login.signIn')}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleMagicLinkSubmit} className="mt-5 flex flex-col gap-3.5">
              <div>
                <Label>{t('login.emailLabel')}</Label>
                <Input
                  type="email"
                  required
                  autoComplete="username"
                  placeholder={t('login.emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={status === 'sending'} className="mt-1 w-full">
                {status === 'sending' ? t('login.sending') : t('login.sendMagicLink')}
              </Button>
            </form>
          )}

          {status === 'sent' && (
            <p className="mt-3 text-sm text-emerald-700">{t('login.magicLinkSent')}</p>
          )}
          {status === 'error' && (
            <p className="mt-3 text-sm text-rose-600">{errorMessage ?? t('common.errorRetry')}</p>
          )}

          <p className="mt-6 text-xs leading-relaxed text-slate-400">{t('login.helpNote')}</p>
        </div>
      </section>
    </main>
  );
}
