'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale } from '@/lib/i18n/LocaleProvider';

/**
 * Sklad is four screens now, not one. They sit under a tab strip rather than
 * in the main sidebar so the hub keeps showing two products (Finance, Sklad)
 * rather than six links.
 */
export function SkladNav({ isOrgAdmin }: { isOrgAdmin: boolean }) {
  const pathname = usePathname();
  const { t } = useLocale();

  const tabs = [
    { href: '/hub/sklad', label: t('sklad.nav.stock') },
    { href: '/hub/sklad/items', label: t('sklad.nav.items') },
    { href: '/hub/sklad/orders', label: t('sklad.nav.orders') },
    ...(isOrgAdmin ? [{ href: '/hub/sklad/settings', label: t('sklad.nav.settings') }] : []),
  ];

  return (
    <nav className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
      {tabs.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-900'
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
