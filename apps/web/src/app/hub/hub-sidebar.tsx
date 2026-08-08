'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { MobileNav, type NavGroup } from '@/components/ui/MobileNav';

export function FinanceIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
      <path
        fillRule="evenodd"
        d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zm-5 3a1 1 0 100 2h2a1 1 0 100-2h-2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function SkladIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 010-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 010 3.958 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.517 1 1 0 01-1.15 0z" />
    </svg>
  );
}

function OverviewIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path d="M3 3h6v7H3V3zm8 0h6v4h-6V3zM3 12h6v5H3v-5zm8-3h6v8h-6V9z" />
    </svg>
  );
}

function OrdersIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path
        fillRule="evenodd"
        d="M5 2a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H5zm1 6a1 1 0 000 2h8a1 1 0 100-2H6zm0 4a1 1 0 100 2h5a1 1 0 100-2H6z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function InboundIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path
        fillRule="evenodd"
        d="M10 2a1 1 0 011 1v7.586l2.293-2.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L9 10.586V3a1 1 0 011-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function InvoiceIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path
        fillRule="evenodd"
        d="M4 2a1 1 0 00-1 1v14a1 1 0 001.447.894L6 17.118l1.553.776a1 1 0 00.894 0L10 17.118l1.553.776a1 1 0 00.894 0L14 17.118l1.553.776A1 1 0 0017 17V3a1 1 0 00-1-1H4zm2 4a1 1 0 000 2h8a1 1 0 100-2H6zm0 4a1 1 0 100 2h5a1 1 0 100-2H6z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function OutboundIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path
        fillRule="evenodd"
        d="M10 15a1 1 0 01-1-1V6.414L6.707 8.707a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 6.414V14a1 1 0 01-1 1zm-7 2a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ClientsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path d="M7 8a3 3 0 100-6 3 3 0 000 6zM14.5 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM1.615 16.428a1.224 1.224 0 01-.569-1.175 6.002 6.002 0 0111.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 017 18a9.953 9.953 0 01-5.385-1.572zM14.5 16h-.106c.07-.297.088-.611.048-.933a7.47 7.47 0 00-1.588-3.755 4.502 4.502 0 015.874 2.636.818.818 0 01-.36.98A7.465 7.465 0 0114.5 16z" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path
        fillRule="evenodd"
        d="M11.078 2.25c.917 0 1.699.663 1.85 1.567l.091.549a.798.798 0 00.517.608 7.45 7.45 0 01.478.2.798.798 0 00.796-.064l.453-.324a1.875 1.875 0 012.416.2l.577.577a1.875 1.875 0 01.2 2.416l-.324.453a.798.798 0 00-.064.796c.078.156.148.316.2.478a.798.798 0 00.608.517l.549.09a1.875 1.875 0 011.567 1.851v.815c0 .917-.663 1.699-1.567 1.85l-.549.091a.798.798 0 00-.608.517 7.45 7.45 0 01-.2.478.798.798 0 00.064.796l.324.453a1.875 1.875 0 01-.2 2.416l-.577.577a1.875 1.875 0 01-2.416.2l-.453-.324a.798.798 0 00-.796-.064 7.45 7.45 0 01-.478.2.798.798 0 00-.517.608l-.09.549a1.875 1.875 0 01-1.851 1.567h-.815a1.875 1.875 0 01-1.85-1.567l-.091-.549a.798.798 0 00-.517-.608 7.45 7.45 0 01-.478-.2.798.798 0 00-.796.064l-.453.324a1.875 1.875 0 01-2.416-.2l-.577-.577a1.875 1.875 0 01-.2-2.416l.324-.453a.798.798 0 00.064-.796 7.45 7.45 0 01-.2-.478.798.798 0 00-.608-.517l-.549-.09A1.875 1.875 0 012.25 11.893v-.815c0-.917.663-1.699 1.567-1.85l.549-.091a.798.798 0 00.608-.517c.052-.162.122-.322.2-.478a.798.798 0 00-.064-.796l-.324-.453a1.875 1.875 0 01.2-2.416l.577-.577a1.875 1.875 0 012.416-.2l.453.324a.798.798 0 00.796.064c.156-.078.316-.148.478-.2a.798.798 0 00.517-.608l.09-.549a1.875 1.875 0 011.851-1.567h.815zM10 13.25a3.25 3.25 0 100-6.5 3.25 3.25 0 000 6.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function SignOutIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path
        fillRule="evenodd"
        d="M3 3a1 1 0 011-1h6a1 1 0 010 2H5v12h5a1 1 0 010 2H4a1 1 0 01-1-1V3zm10.293 3.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L14.586 11H8a1 1 0 010-2h6.586l-1.293-1.293a1 1 0 010-1.414z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CollapseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path
        fillRule="evenodd"
        d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

const COLLAPSE_KEY = 'mubosher.sidebar.collapsed';

/**
 * The single navigation for the whole product.
 *
 * It used to be two: this rail listed three destinations, and every warehouse
 * screen then grew a second tab strip of its own. Two navigations on one page
 * means neither one tells you where you are — so the sections are here now,
 * grouped and labelled, and the tab strip is gone.
 *
 * The pattern is the enterprise one (SAP Fiori, Oracle Redwood): a fixed rail
 * with headed groups, a left accent bar on the current page, and a collapse
 * to icons for people who work in one screen all day and want the width back.
 * The collapsed state is remembered, because re-collapsing it every morning is
 * exactly the kind of small friction that makes software feel cheap.
 */
export function HubSidebar({
  orgName,
  userEmail,
  isOrgAdmin,
}: {
  orgName: string | null;
  userEmail: string;
  isOrgAdmin: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLocale();
  const [collapsed, setCollapsed] = useState(false);

  // Read after mount: the server has no localStorage, and rendering the
  // expanded rail first avoids a flash of the wrong width on a fast machine.
  useEffect(() => {
    setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === '1');
  }, []);

  function toggleCollapsed() {
    setCollapsed((current) => {
      window.localStorage.setItem(COLLAPSE_KEY, current ? '0' : '1');
      return !current;
    });
  }

  const groups: NavGroup[] = [
    {
      title: t('hub.finance'),
      items: [
        // Same labels the Finance sidebar uses, so one product does not call
        // the same page two different things depending on where you came from.
        { href: '/dashboard', label: t('nav.clients'), Icon: FinanceIcon },
        { href: '/clients', label: t('nav.allClients'), Icon: ClientsIcon },
      ],
    },
    {
      title: t('hub.sklad'),
      items: [
        { href: '/hub/sklad', label: t('sklad.nav.overview'), Icon: OverviewIcon },
        { href: '/hub/sklad/orders', label: t('sklad.nav.orders'), Icon: OrdersIcon },
        { href: '/hub/sklad/stock', label: t('sklad.nav.stock'), Icon: SkladIcon },
      ],
    },
    // Goods in and goods out are the two things a storekeeper actually does,
    // and they are done from a page each rather than a dialog. Their own group,
    // so they read as the day's work and not as another report.
    {
      title: t('sklad.nav.operations'),
      items: [
        { href: '/hub/sklad/faktura', label: t('sklad.nav.invoices'), Icon: InvoiceIcon },
        { href: '/hub/sklad/kirim', label: t('sklad.nav.receiving'), Icon: InboundIcon },
        { href: '/hub/sklad/chiqim', label: t('sklad.nav.issuing'), Icon: OutboundIcon },
      ],
    },
    ...(isOrgAdmin
      ? [
          {
            title: t('hub.settings'),
            items: [
              { href: '/hub/sklad/settings', label: t('sklad.nav.settings'), Icon: SkladIcon },
              { href: '/hub/settings', label: t('nav.organization'), Icon: SettingsIcon },
            ],
          },
        ]
      : []),
  ];

  /** The order screen keeps its section lit; `/hub/sklad` itself must not, or
   * every child route would light the overview too. */
  function isActive(href: string): boolean {
    if (href === '/hub/sklad' || href === '/dashboard') return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const footer = (
    <>
      {orgName && <p className="truncate text-xs font-semibold text-slate-700">{orgName}</p>}
      <p className="truncate text-xs text-slate-400">{userEmail}</p>
      <button
        type="button"
        onClick={handleSignOut}
        className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-rose-600"
      >
        <SignOutIcon className="h-3.5 w-3.5" />
        {t('nav.signOut')}
      </button>
    </>
  );

  return (
    <>
      <MobileNav title={t('nav.menu')} footer={footer} groups={groups} />

      <aside
        className={`no-print sticky top-[57px] hidden h-[calc(100vh-57px)] shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white transition-[width] duration-200 lg:flex ${
          collapsed ? 'w-[60px]' : 'w-60'
        }`}
      >
        <nav className="flex-1 p-2">
          {groups.map((group, groupIndex) => (
            <div key={group.title ?? groupIndex} className={groupIndex > 0 ? 'mt-4' : undefined}>
              {/* The heading is what makes a rail readable at a glance; with no
                  room for it, a hairline keeps the grouping visible. */}
              {collapsed ? (
                groupIndex > 0 && <div className="mx-2 mb-2 border-t border-slate-200" />
              ) : (
                <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {group.title}
                </p>
              )}

              {group.items.map(({ href, label, Icon }) => {
                const active = isActive(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    title={collapsed ? label : undefined}
                    aria-current={active ? 'page' : undefined}
                    className={`relative flex items-center gap-2.5 rounded-lg py-2 text-sm font-medium transition-colors ${
                      collapsed ? 'justify-center px-0' : 'px-3'
                    } ${
                      active
                        ? 'bg-brand-50 text-brand-700'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    {active && (
                      <span className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-brand-600" />
                    )}
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="truncate">{label}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-200 p-2">
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={t('nav.collapse')}
            title={t('nav.collapse')}
            className={`mb-2 flex w-full items-center gap-2 rounded-lg py-2 text-xs font-medium text-slate-400 hover:bg-slate-50 hover:text-slate-700 ${
              collapsed ? 'justify-center' : 'px-3'
            }`}
          >
            <CollapseIcon
              className={`h-4 w-4 transition-transform ${collapsed ? 'rotate-180' : ''}`}
            />
            {!collapsed && t('nav.collapse')}
          </button>

          {!collapsed && <div className="px-1">{footer}</div>}
        </div>
      </aside>
    </>
  );
}
