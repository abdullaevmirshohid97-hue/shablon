'use client';

import { useLocale } from '@/lib/i18n/LocaleProvider';
import type { NavGroup } from '@/components/ui/MobileNav';
import { ModuleSidebar } from '../module-sidebar';
import { ClientsIcon, InvoiceIcon, OutboundIcon, SkladIcon } from '../nav-icons';

/**
 * Sotuv bo'limi, in the order the work happens: who is buying, what was
 * invoiced, what is being loaded, and what has left.
 */
export function SotuvSidebar({
  orgName,
  userEmail,
}: {
  orgName: string | null;
  userEmail: string;
}) {
  const { t } = useLocale();

  const groups: NavGroup[] = [
    {
      title: t('hub.sotuv'),
      items: [
        { href: '/hub/sotuv', label: t('sotuv.clients'), Icon: ClientsIcon },
        { href: '/hub/sotuv/faktura', label: t('sklad.nav.invoices'), Icon: InvoiceIcon },
      ],
    },
    {
      title: t('sotuv.despatchGroup'),
      items: [
        { href: '/hub/sotuv/skaner', label: t('sotuv.scanTitle'), Icon: SkladIcon },
        { href: '/hub/sotuv/chiqim', label: t('sklad.nav.issuing'), Icon: OutboundIcon },
      ],
    },
  ];

  return (
    <ModuleSidebar
      groups={groups}
      orgName={orgName}
      userEmail={userEmail}
      backHref="/hub"
      backLabel={t('hub.backToModules')}
      title={t('hub.sotuv')}
    />
  );
}
