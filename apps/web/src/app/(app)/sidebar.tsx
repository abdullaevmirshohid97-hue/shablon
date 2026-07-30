'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { useOrgRole } from '@/lib/auth/OrgRoleProvider';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

function ClientsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path d="M10 9a3 3 0 100-6 3 3 0 000 6zM6 15a4 4 0 018 0v1H6v-1zM15 8a2 2 0 100-4 2 2 0 000 4zM18 15v-.5a3.5 3.5 0 00-3.5-3.5h-.29c.5.6.79 1.37.79 2.2V15h3zM5 8a2 2 0 100-4 2 2 0 000 4zM2 15v-.5A3.5 3.5 0 015.5 11h.29A3.48 3.48 0 005 13.2V15H2z" />
    </svg>
  );
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path d="M3 3a1 1 0 011 1v11h12a1 1 0 110 2H3a1 1 0 01-1-1V4a1 1 0 011-1z" />
      <path d="M6.293 11.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0L12 8.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0L10 9.414l-2.293 2.293a1 1 0 01-1.414 0z" />
    </svg>
  );
}

function ModuleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path d="M4 4a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V4zM11 4a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V4zM4 11a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1v-5zM11 11a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1h-4a1 1 0 01-1-1v-5z" />
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

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
      <path
        fillRule="evenodd"
        d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
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

export function Sidebar({
  orgName,
  userEmail,
  moduleCategories,
}: {
  orgName: string | null;
  userEmail: string;
  moduleCategories: string[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLocale();
  const { canWrite } = useOrgRole();

  // Settings is admin-only (modules + the change log); the page itself
  // redirects managers away, this just stops offering them a dead end.
  const items = [
    { href: '/dashboard', label: t('nav.clients'), Icon: ChartIcon },
    { href: '/clients', label: t('nav.allClients'), Icon: ClientsIcon },
    ...(canWrite ? [{ href: '/settings', label: t('nav.settings'), Icon: SettingsIcon }] : []),
  ];

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <aside className="no-print sticky top-[57px] hidden h-[calc(100vh-57px)] w-60 shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white lg:flex">
      <nav className="flex-1 space-y-0.5 p-3">
        {items.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}

        {moduleCategories.length > 0 && (
          <div className="pt-4">
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {t('nav.modules')}
            </p>
            {moduleCategories.map((category) => {
              const href = `/dashboard/${encodeURIComponent(category)}`;
              const active = pathname === href;
              return (
                <Link
                  key={category}
                  href={href}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <ModuleIcon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{category}</span>
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      <div className="border-t border-slate-200 p-3">
        {orgName && <p className="truncate text-xs font-semibold text-slate-700">{orgName}</p>}
        <p className="truncate text-xs text-slate-400">{userEmail}</p>
        {!canWrite && (
          <span className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
            <EyeIcon className="h-3 w-3" />
            {t('readOnly.badge')}
          </span>
        )}
        <button
          type="button"
          onClick={handleSignOut}
          className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-rose-600"
        >
          <SignOutIcon className="h-3.5 w-3.5" />
          {t('nav.signOut')}
        </button>
      </div>
    </aside>
  );
}
