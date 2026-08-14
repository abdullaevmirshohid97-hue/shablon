'use client';

import { ontology } from '@mubosher/shared';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import type { NavGroup } from '@/components/ui/MobileNav';
import { ModuleSidebar } from './module-sidebar';
import { iconFor } from './nav-icons';

/**
 * The hub rail lists the business, not the screens.
 *
 * It used to carry every warehouse page as well, which meant the top level of
 * the product was fifteen links deep and no module owned its own navigation.
 * Now each module's pages live in that module's rail, and this one answers a
 * single question: which part of the company are you working in.
 *
 * The list itself is no longer written here either. It comes from the
 * ontology's module manifests, so a new module appears in the rail by being
 * declared rather than by being remembered — which is the failure this file
 * kept having: three places listed the modules and any one of them could be
 * the one that was forgotten.
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

  const groups: NavGroup[] = ontology.hubGroups({ isOrgAdmin }).map((group) => ({
    title: group.titleKey ? t(group.titleKey) : undefined,
    items: group.items.map((item) => ({
      href: item.href,
      label: t(item.labelKey),
      Icon: iconFor(item.icon),
    })),
  }));

  return (
    <ModuleSidebar groups={groups} orgName={orgName} userEmail={userEmail} title={t('nav.menu')} />
  );
}
