'use client';

import { useLocale } from '@/lib/i18n/LocaleProvider';
import type { NavGroup } from '@/components/ui/MobileNav';
import { ModuleSidebar } from './module-sidebar';
import { FinanceIcon, SalesIcon, SettingsIcon, SkladIcon } from './nav-icons';

/**
 * The hub rail lists the business, not the screens.
 *
 * It used to carry every warehouse page as well, which meant the top level of
 * the product was fifteen links deep and no module owned its own navigation.
 * Now each module's pages live in that module's rail, and this one answers a
 * single question: which part of the company are you working in.
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
  const { t } = useLocale();

  const groups: NavGroup[] = [
    {
      title: t('hub.modules'),
      items: [
        { href: '/dashboard', label: t('hub.finance'), Icon: FinanceIcon },
        { href: '/hub/sklad', label: t('hub.sklad'), Icon: SkladIcon },
        { href: '/hub/sotuv', label: t('hub.sotuv'), Icon: SalesIcon },
      ],
    },
    ...(isOrgAdmin
      ? [
          {
            title: t('hub.settings'),
            items: [{ href: '/hub/settings', label: t('nav.organization'), Icon: SettingsIcon }],
          },
        ]
      : []),
  ];

  return (
    <ModuleSidebar groups={groups} orgName={orgName} userEmail={userEmail} title={t('nav.menu')} />
  );
}
