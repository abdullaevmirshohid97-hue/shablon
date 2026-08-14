'use client';

import { ontology } from '@mubosher/shared';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import type { NavGroup } from '@/components/ui/MobileNav';
import { ModuleSidebar } from '../module-sidebar';
import { iconFor } from '../nav-icons';

/**
 * Sotuv bo'limi, in the order the work happens: who is buying, what was
 * invoiced, what is being loaded, and what has left — as its manifest declares
 * it.
 */
export function SotuvSidebar({
  orgName,
  userEmail,
  isOrgAdmin = false,
}: {
  orgName: string | null;
  userEmail: string;
  isOrgAdmin?: boolean;
}) {
  const { t } = useLocale();

  const groups: NavGroup[] = ontology.navGroups('sotuv', { isOrgAdmin }).map((group) => ({
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
      title={t('hub.sotuv')}
    />
  );
}
