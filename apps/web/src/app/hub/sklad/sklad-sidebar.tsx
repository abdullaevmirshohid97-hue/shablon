'use client';

import { ontology } from '@mubosher/shared';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import type { NavGroup } from '@/components/ui/MobileNav';
import { ModuleSidebar } from '../module-sidebar';
import { iconFor } from '../nav-icons';

/**
 * The warehouse's own rail: where stock stands, what has been ordered, and the
 * one operation a storekeeper performs — booking goods in. Goods *out* left for
 * Sotuv bo'limi along with the invoice that authorises it, because issuing
 * stock is the last step of a sale, not a warehouse errand.
 *
 * Which is a rule about duty, so it is kept where duties are kept: the module's
 * manifest in the ontology. This file draws whatever that says.
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

  const groups: NavGroup[] = ontology.navGroups('sklad', { isOrgAdmin }).map((group) => ({
    title: group.titleKey ? t(group.titleKey) : undefined,
    items: group.items.map((item) => ({
      href: item.href,
      label: t(item.labelKey),
      Icon: iconFor(item.icon),
    })),
  }));

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
