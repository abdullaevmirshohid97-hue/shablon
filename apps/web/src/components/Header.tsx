'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Segmented } from '@/components/ui/Segmented';
import { PwaInstall } from '@/components/PwaInstall';

export function Header() {
  const { locale, setLocale, t } = useLocale();
  const pathname = usePathname();

  // Super-admin panelining o'z sarlavhasi bor (AdminShell) — bu yerda ko'rsatmaymiz.
  if (pathname?.startsWith('/admin')) return null;

  // Kirish sahifasi butun ekranni egallaydi (chapda brend paneli) va tilni
  // o'zi almashtiradi — ustiga umumiy sarlavha qo'yilsa split buziladi.
  if (pathname === '/login') return null;

  // Faqat Finance ilovasi (dashboard/clients/settings/counterparty) ichida
  // "Finance" nomi + orqaga tugmasi ko'rinadi; login va hub'da umumiy brend.
  const financePrefixes = ['/dashboard', '/clients', '/settings', '/counterparty'];
  const inFinance = financePrefixes.some((p) => pathname === p || pathname?.startsWith(`${p}/`));

  return (
    <header className="no-print sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="flex items-center justify-between px-4 py-3 sm:px-6 lg:px-10">
        <div className="flex items-center gap-3">
          <Link href="/hub" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
              M
            </span>
            <span className="font-semibold tracking-tight text-slate-900">
              {inFinance ? t('header.title') : t('header.brand')}
            </span>
          </Link>
          {inFinance && (
            <Link
              href="/hub"
              className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path
                  fillRule="evenodd"
                  d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
                  clipRule="evenodd"
                />
              </svg>
              {t('nav.back')}
            </Link>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Removes itself once the app is installed, and on browsers that
              have no way to install anything. */}
          <PwaInstall className="hidden sm:inline-flex" />
          <Segmented
            value={locale}
            onChange={setLocale}
            options={[
              { value: 'uz', label: 'UZ' },
              { value: 'ru', label: 'RU' },
            ]}
          />
        </div>
      </div>
    </header>
  );
}
