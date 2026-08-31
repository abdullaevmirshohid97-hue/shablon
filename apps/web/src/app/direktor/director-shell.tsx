'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import type { OrgOption } from '@/lib/auth/activeOrg';
import { DirectorGate } from './director-gate';

const TABS = [
  { href: '/direktor', key: 'director.tabOverview' },
  { href: '/direktor/mijozlar', key: 'director.tabClients' },
  { href: '/direktor/menejerlar', key: 'director.tabManagers' },
  { href: '/direktor/sozlamalar', key: 'director.tabSettings' },
] as const;

/**
 * The frame around the director's screens.
 *
 * No organization switcher and no sidebar: this is the one place in the app
 * that is not looking at a single business, so a control for choosing one
 * would be a control that means nothing here.
 */
export function DirectorShell({
  orgs,
  children,
}: {
  orgs: OrgOption[];
  children: React.ReactNode;
}) {
  const { t } = useLocale();
  const pathname = usePathname();

  return (
    <DirectorGate orgs={orgs}>
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-10">
        <div className="mb-4">
          <Link
            href="/hub"
            className="inline-flex items-center gap-1 text-fin-md text-slate-500 hover:text-slate-700"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
              <path
                fillRule="evenodd"
                d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            {t('hub.backToModules')}
          </Link>
          <h1 className="mt-2 text-fin-2xl font-semibold tracking-tight text-slate-900">
            {t('director.title')}
          </h1>
          <p className="mt-1 text-fin-md text-slate-500">
            {t('director.scopeNote').replace('{n}', String(orgs.length))}
          </p>
        </div>

        <nav className="mb-6 flex flex-wrap gap-1 border-b border-slate-200">
          {TABS.map((tab) => {
            const active =
              tab.href === '/direktor' ? pathname === tab.href : pathname?.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`-mb-px border-b-2 px-3 py-2 text-fin-md font-medium transition-colors ${
                  active
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                {t(tab.key)}
              </Link>
            );
          })}
        </nav>

        {children}
      </div>
    </DirectorGate>
  );
}
