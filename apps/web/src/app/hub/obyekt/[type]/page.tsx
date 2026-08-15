import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ontology, propertyColumn } from '@mubosher/shared';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServerTranslator } from '@/lib/i18n/server';
import { Card } from '@/components/ui/Card';
import { requireModuleAccess } from '../../access';
import { explorerHref, loadObjectList, previewProperties, rowLabel } from '@/lib/ontology/read';
import { alignsRight, EMPTY, formatValue } from '@/lib/ontology/format';

/**
 * One object type, listed. The columns are whichever properties the ontology
 * says are worth a glance, so no list here was laid out by hand.
 */
export default async function ObjectListPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { type } = await params;
  const { q } = await searchParams;
  const objectType = ontology.objectType(type);
  if (!objectType) notFound();

  const { orgId } = await requireModuleAccess();
  const { t } = await getServerTranslator();
  const supabase = await createSupabaseServerClient();

  const page = await loadObjectList(supabase, type, orgId, { search: q });
  if (!page) notFound();

  const columns = previewProperties(objectType);
  const owner = ontology.module(objectType.owner);

  return (
    <div className="flex flex-col gap-4">
      <header>
        <p className="text-fin-sm font-medium uppercase tracking-wide text-slate-500">
          {owner ? t(owner.titleKey) : objectType.owner}
        </p>
        <h1 className="text-xl font-semibold text-slate-900">{objectType.plural}</h1>
        <p className="mt-1 font-mono text-fin-xs text-slate-400">{objectType.table}</p>
      </header>

      <form className="flex gap-2" action={`/hub/obyekt/${objectType.id}`}>
        <input
          type="search"
          name="q"
          defaultValue={q ?? ''}
          placeholder={t('ontology.searchPlaceholder')}
          className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-fin-md"
        />
      </form>

      {page.error && (
        <Card className="p-4 text-fin-md text-rose-700">
          {t('ontology.loadFailed')}: {page.error}
        </Card>
      )}

      {page.rows.length === 0 && !page.error ? (
        <Card className="p-6 text-fin-md text-slate-500">{t('ontology.empty')}</Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-fin-md">
            <thead>
              <tr className="border-b border-slate-200 text-left text-fin-sm text-slate-500">
                <th className="px-4 py-2 font-medium">{objectType.title}</th>
                {columns.slice(1).map((property) => (
                  <th
                    key={property.id}
                    className={`px-4 py-2 font-medium ${alignsRight(property) ? 'text-right' : ''}`}
                  >
                    {property.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {page.rows.map((row, index) => {
                const href = explorerHref(objectType, row);
                return (
                  <tr key={href ?? index} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2">
                      {href ? (
                        <Link href={href} className="font-medium text-brand-700 hover:underline">
                          {rowLabel(objectType, row)}
                        </Link>
                      ) : (
                        rowLabel(objectType, row)
                      )}
                    </td>
                    {columns.slice(1).map((property) => {
                      const column = propertyColumn(property);
                      return (
                        <td
                          key={property.id}
                          className={`px-4 py-2 text-slate-700 ${
                            alignsRight(property) ? 'text-right tabular-nums' : ''
                          }`}
                        >
                          {column ? formatValue(property, row[column]) : EMPTY}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
