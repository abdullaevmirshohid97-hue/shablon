'use client';

import { ontology } from '@mubosher/shared';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import type { NavGroup } from '@/components/ui/MobileNav';
import { ModuleSidebar } from '../module-sidebar';
import { iconFor } from '../nav-icons';

/**
 * The explorer's rail is the ontology itself: every object, under the module
 * answerable for it.
 *
 * Which makes it the one screen in the product where the shape of the company
 * is visible in a single glance — Sotuv's five nouns sitting under Sotuv,
 * Sklad's nine under Sklad, and nothing owned twice.
 */
export function ObyektSidebar({
  orgName,
  userEmail,
}: {
  orgName: string | null;
  userEmail: string;
}) {
  const { t } = useLocale();

  const groups: NavGroup[] = [
    {
      items: [{ href: '/hub/obyekt', label: t('ontology.map'), Icon: iconFor('graph') }],
    },
    ...ontology.modules
      .map((module) => ({
        title: t(module.titleKey),
        items: ontology.objectsOwnedBy(module.id).map((objectType) => ({
          href: `/hub/obyekt/${objectType.id}`,
          label: objectType.plural,
          Icon: iconFor(module.icon),
        })),
      }))
      .filter((group) => group.items.length > 0),
  ];

  return (
    <ModuleSidebar
      groups={groups}
      orgName={orgName}
      userEmail={userEmail}
      backHref="/hub"
      backLabel={t('hub.backToModules')}
      title={t('ontology.title')}
    />
  );
}
