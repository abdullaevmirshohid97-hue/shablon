'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

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

  const items = [
    { href: '/dashboard', label: t('hub.finance'), Icon: FinanceIcon },
    { href: '/hub/sklad', label: t('hub.sklad'), Icon: SkladIcon },
    ...(isOrgAdmin
      ? [{ href: '/hub/settings', label: t('hub.settings'), Icon: SettingsIcon }]
      : []),
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
      </nav>

      <div className="border-t border-slate-200 p-3">
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
      </div>
    </aside>
  );
}
