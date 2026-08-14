import Link from 'next/link';
import { ontology } from '@mubosher/shared';
import { getServerTranslator } from '@/lib/i18n/server';
import { Card } from '@/components/ui/Card';
import { iconFor } from '../nav-icons';

/**
 * The front door: one tile per part of the business, and nothing else.
 *
 * The parts are the ontology's modules — the same list the rail draws, from the
 * same manifests, so the door and the rail cannot come to disagree about what
 * the company is made of.
 */
export default async function HubPage() {
  const { t } = await getServerTranslator();
  const tiles = ontology.tiles({ isOrgAdmin: false });

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tiles.map((module) => {
        const Icon = iconFor(module.icon);
        return (
          <Link key={module.href} href={module.href}>
            <Card className="flex h-full flex-col gap-2 p-6 transition-shadow hover:shadow-md">
              <Icon className="h-8 w-8 text-brand-600" />
              <h2 className="text-lg font-semibold text-slate-900">{t(module.titleKey)}</h2>
              <p className="text-sm text-slate-500">
                {module.descriptionKey ? t(module.descriptionKey) : null}
              </p>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
