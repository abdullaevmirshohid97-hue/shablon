'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Card } from '@/components/ui/Card';
import { Input, Label } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';

export default function LoginPage() {
  const router = useRouter();
  const { t } = useLocale();
  const [mode, setMode] = useState<'password' | 'magic-link'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    router.push('/dashboard');
    router.refresh();
  }

  async function handleMagicLinkSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    setErrorMessage(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) {
      setStatus('error');
      setErrorMessage(error.message);
      return;
    }
    setStatus('sent');
  }

  return (
    <main className="flex min-h-[calc(100vh-57px)] items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-5 flex flex-col items-center gap-2 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white">
            M
          </span>
          <h1 className="text-lg font-semibold text-slate-900">{t('login.title')}</h1>
        </div>

        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'password', label: t('login.tabPassword') },
            { value: 'magic-link', label: t('login.tabMagicLink') },
          ]}
        />

        {mode === 'password' ? (
          <form onSubmit={handlePasswordSubmit} className="mt-4 flex flex-col gap-3">
            <div>
              <Label>{t('login.emailPlaceholder')}</Label>
              <Input
                type="email"
                required
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
          <form onSubmit={handleMagicLinkSubmit} className="mt-4 flex flex-col gap-3">
            <div>
              <Label>{t('login.emailPlaceholder')}</Label>
              <Input
                type="email"
                required
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
          <p className="mt-3 text-sm text-emerald-600">{t('login.magicLinkSent')}</p>
        )}
        {status === 'error' && (
          <p className="mt-3 text-sm text-rose-600">{errorMessage ?? t('common.errorRetry')}</p>
        )}
      </Card>
    </main>
  );
}
