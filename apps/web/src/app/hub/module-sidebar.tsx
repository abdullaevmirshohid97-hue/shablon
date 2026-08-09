'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { MobileNav, type NavGroup } from '@/components/ui/MobileNav';
import { BackIcon, SignOutIcon } from './nav-icons';

const COLLAPSE_KEY = 'mubosher.sidebar.collapsed';

/**
 * One rail, three tenants.
 *
 * The hub lists the modules a company runs; each module then lists its own
 * screens. Which set you see is the whole navigational answer to "where am I" —
 * so the rail is never both at once. Inside a module the first thing in the
 * rail is the way back out, because a module you cannot leave is a trap.
 *
 * The pattern is the enterprise one (SAP Fiori, Oracle Redwood): a fixed rail
 * with headed groups, a left accent bar on the current page, and a collapse to
 * icons for people who work in one screen all day and want the width back. The
 * collapsed state is remembered across modules — re-collapsing it every morning
 * is exactly the kind of small friction that makes software feel cheap.
 */
export function ModuleSidebar({
  groups,
  orgName,
  userEmail,
  /** Shown at the top inside a module; omitted on the hub, which is the top. */
  backHref,
  backLabel,
  /** Names the section in the mobile drawer's header. */
  title,
}: {
  groups: NavGroup[];
  orgName: string | null;
  userEmail: string;
  backHref?: string;
  backLabel?: string;
  title: string;
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

  /** A module's own root (`/hub/sklad`) must match exactly, or every child
   * route inside it would light the overview too. */
  function isActive(href: string): boolean {
    const isModuleRoot = groups.some((g) =>
      g.items.some((i) => i.href !== href && i.href.startsWith(`${href}/`)),
    );
    if (isModuleRoot) return pathname === href;
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
      <p className="truncate text-xs text-slate-500">{userEmail}</p>
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

  const backLink = backHref ? (
    <Link
      href={backHref}
      title={collapsed ? (backLabel ?? t('nav.back')) : undefined}
      className={`mb-2 flex items-center gap-2 rounded-lg py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900 ${
        collapsed ? 'justify-center px-0' : 'px-3'
      }`}
    >
      <BackIcon className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="truncate">{backLabel ?? t('nav.back')}</span>}
    </Link>
  ) : null;

  return (
    <>
      <MobileNav
        title={title}
        footer={footer}
        groups={
          backHref
            ? [
                { items: [{ href: backHref, label: backLabel ?? t('nav.back'), Icon: BackIcon }] },
                ...groups,
              ]
            : groups
        }
      />

      <aside
        className={`no-print sticky top-[57px] hidden h-[calc(100vh-57px)] shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white transition-[width] duration-200 lg:flex ${
          collapsed ? 'w-[60px]' : 'w-60'
        }`}
      >
        <nav className="flex-1 p-2">
          {backLink}
          {groups.map((group, groupIndex) => (
            <div key={group.title ?? groupIndex} className={groupIndex > 0 ? 'mt-4' : undefined}>
              {/* The heading is what makes a rail readable at a glance; with no
                  room for it, a hairline keeps the grouping visible. */}
              {collapsed
                ? groupIndex > 0 && <div className="mx-2 mb-2 border-t border-slate-200" />
                : group.title && (
                    <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
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
            className={`mb-2 flex w-full items-center gap-2 rounded-lg py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700 ${
              collapsed ? 'justify-center' : 'px-3'
            }`}
          >
            <BackIcon className={`h-4 w-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
            {!collapsed && t('nav.collapse')}
          </button>

          {!collapsed && <div className="px-1">{footer}</div>}
        </div>
      </aside>
    </>
  );
}

/** The frame every module shares: its rail on the left, its pages on the right. */
export function ModuleShell({
  sidebar,
  children,
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex w-full">
      {sidebar}
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</main>
    </div>
  );
}
