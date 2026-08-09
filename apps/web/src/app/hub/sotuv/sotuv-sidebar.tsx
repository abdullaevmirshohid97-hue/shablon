'use client';

import { useLocale } from '@/lib/i18n/LocaleProvider';
import type { NavGroup } from '@/components/ui/MobileNav';
import { ModuleSidebar } from '../module-sidebar';
import { InvoiceIcon, OutboundIcon } from '../nav-icons';

/**
 * Sotuv bo'limi: the invoice a manager raises, and the shipment the loading
 * bay issues against it. The two were separate entries in a warehouse rail
 * that also held stock reports; together, on their own, they read as what they
 * are — one desk's work, from order to gate.
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
        { href: '/hub/sotuv/faktura', label: t('sklad.nav.invoices'), Icon: InvoiceIcon },
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
