'use client';

import { useLocale } from '@/lib/i18n/LocaleProvider';
import type { NavGroup } from '@/components/ui/MobileNav';
import { ModuleSidebar } from '../module-sidebar';
import { InboundIcon, OrdersIcon, OverviewIcon, SettingsIcon, SkladIcon } from '../nav-icons';

/**
 * The warehouse's own rail: where stock stands, what has been ordered, and the
 * one operation a storekeeper performs — booking goods in. Goods *out* left for
 * Sotuv bo'limi along with the invoice that authorises it, because issuing
 * stock is the last step of a sale, not a warehouse errand.
 */
export function SkladSidebar({
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
      title: t('hub.sklad'),
      items: [
        { href: '/hub/sklad', label: t('sklad.nav.overview'), Icon: OverviewIcon },
        { href: '/hub/sklad/orders', label: t('sklad.nav.orders'), Icon: OrdersIcon },
        { href: '/hub/sklad/stock', label: t('sklad.nav.stock'), Icon: SkladIcon },
      ],
    },
    {
      title: t('sklad.nav.operations'),
      items: [{ href: '/hub/sklad/kirim', label: t('sklad.nav.receiving'), Icon: InboundIcon }],
    },
    ...(isOrgAdmin
      ? [
          {
            title: t('hub.settings'),
            items: [
              { href: '/hub/sklad/settings', label: t('sklad.nav.settings'), Icon: SettingsIcon },
            ],
          },
        ]
      : []),
  ];

  return (
    <ModuleSidebar
      groups={groups}
      orgName={orgName}
      userEmail={userEmail}
      backHref="/hub"
      backLabel={t('hub.backToModules')}
      title={t('hub.sklad')}
    />
  );
}
