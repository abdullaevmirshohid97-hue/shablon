'use client';

import Link from 'next/link';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Segmented } from '@/components/ui/Segmented';

export function Header() {
  const { locale, setLocale, t } = useLocale();

  return (
    <header className="no-print sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            M
          </span>
          <span className="font-semibold tracking-tight text-slate-900">{t('header.title')}</span>
        </Link>

        <Segmented
          value={locale}
          onChange={setLocale}
          options={[
            { value: 'uz', label: 'UZ' },
            { value: 'ru', label: 'RU' },
          ]}
        />
      </div>
    </header>
  );
}
