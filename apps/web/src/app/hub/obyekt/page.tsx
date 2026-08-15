import Link from 'next/link';
import { ontology } from '@mubosher/shared';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServerTranslator } from '@/lib/i18n/server';
import { Card } from '@/components/ui/Card';
import { requireModuleAccess } from '../access';
import { countObjects } from '@/lib/ontology/read';

/**
 * The map: every object in the business, under the module answerable for it,
 * with how many of them the person looking is allowed to see.
 *
 * The counts are what make it a map rather than a diagram — a module with nine
 * declared objects and rows in two of them is a module that has been half
 * built, and that is worth being able to see on one screen.
 */
export default async function ObyektMapPage() {
  const { orgId } = await requireModuleAccess();
  const { t } = await getServerTranslator();
  const supabase = await createSupabaseServerClient();

  // One count per object type, all at once: they are independent and each is a
  // head request, so the page waits for the slowest rather than for the sum.
  const counts = new Map(
    await Promise.all(
      ontology.objectTypes.map(
        async (objectType) =>
          [objectType.id, await countObjects(supabase, objectType, orgId)] as const,
      ),
    ),
  );

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">{t('ontology.title')}</h1>
        <p className="mt-1 max-w-3xl text-fin-md text-slate-500">{t('ontology.mapIntro')}</p>
      </header>

      {ontology.modules.map((module) => {
        const owned = ontology.objectsOwnedBy(module.id);
        if (owned.length === 0) return null;

        const dependencies = ontology.dependenciesOf(module.id);

        return (
          <section key={module.id} className="flex flex-col gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{t(module.titleKey)}</h2>
              <p className="mt-1 max-w-3xl text-fin-md text-slate-500">{module.purpose}</p>
              {dependencies.length > 0 && (
                <p className="mt-1 text-fin-sm text-slate-400">
                  {t('ontology.dependsOn')}:{' '}
                  {dependencies
                    .map((id) => {
                      const dependency = ontology.module(id);
                      return dependency ? t(dependency.titleKey) : id;
                    })
                    .join(', ')}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {owned.map((objectType) => {
                const count = counts.get(objectType.id);
                const links = ontology.traversalsFrom(objectType.id);

                return (
                  <Link key={objectType.id} href={`/hub/obyekt/${objectType.id}`}>
                    <Card className="flex h-full flex-col gap-1 p-4 transition-shadow hover:shadow-md">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-semibold text-slate-900">{objectType.plural}</span>
                        <span className="text-fin-lg font-semibold tabular-nums text-slate-700">
                          {count ?? '—'}
                        </span>
                      </div>
                      <span className="font-mono text-fin-xs text-slate-400">
                        {objectType.table}
                      </span>
                      <span className="mt-auto pt-1 text-fin-sm text-slate-500">
                        {t('ontology.linkCount').replace('{n}', String(links.length))}
                      </span>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
