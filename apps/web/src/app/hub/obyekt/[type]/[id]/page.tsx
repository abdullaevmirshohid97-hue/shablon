import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ontology, propertyColumn, storedProperties } from '@mubosher/shared';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServerTranslator } from '@/lib/i18n/server';
import { Card } from '@/components/ui/Card';
import { requireModuleAccess } from '../../../access';
import {
  explorerHref,
  loadObject,
  ownPageHref,
  previewProperties,
  rowLabel,
  type NeighbourGroup,
} from '@/lib/ontology/read';
import { alignsRight, EMPTY, formatValue } from '@/lib/ontology/format';

/**
 * One object, and everything it touches.
 *
 * This is the screen the ontology was built for. Nothing below knows what a
 * sack or an invoice is: it reads the declarations, follows every link in both
 * directions, and renders whatever comes back. Which means the sack shows its
 * invoice, its client and the lot each line came out of — three modules deep —
 * without a line of code that mentions any of them.
 */
export default async function ObjectDetailPage({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  const { type, id } = await params;
  const objectType = ontology.objectType(type);
  if (!objectType) notFound();

  const { orgId } = await requireModuleAccess();
  const { t } = await getServerTranslator();
  const supabase = await createSupabaseServerClient();

  const detail = await loadObject(supabase, type, decodeURIComponent(id), orgId);
  if (!detail) notFound();

  const { row, neighbours } = detail;
  const owner = ontology.module(objectType.owner);
  const ownPage = ownPageHref(objectType, row);
  const actions = ontology.actionsOn(objectType.id);

  // A link that resolves to exactly one row reads as a fact about this object;
  // a link that resolves to many reads as a list. Same declarations, two very
  // different shapes on a page.
  const references = neighbours.filter((g) => g.traversal.cardinality === 'one');
  const collections = neighbours.filter((g) => g.traversal.cardinality === 'many');
  const filled = collections.filter((g) => g.rows.length > 0);
  // Named rather than drawn: fifteen empty cards is not information, but the
  // fact that this sack has no despatch yet is.
  const emptyOnes = neighbours.filter((g) => g.rows.length === 0);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-fin-sm font-medium uppercase tracking-wide text-slate-500">
            <Link href={`/hub/obyekt/${objectType.id}`} className="hover:underline">
              {objectType.title}
            </Link>
            {owner && <span className="text-slate-400"> · {t(owner.titleKey)}</span>}
          </p>
          <h1 className="truncate text-xl font-semibold text-slate-900">
            {rowLabel(objectType, row)}
          </h1>
        </div>
        {ownPage && (
          <Link
            href={ownPage}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-fin-md font-medium text-slate-700 hover:bg-slate-50"
          >
            {t('ontology.openOwnPage')} →
          </Link>
        )}
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <h2 className="mb-2 text-fin-sm font-semibold uppercase tracking-wide text-slate-500">
            {t('ontology.properties')}
          </h2>
          <dl className="divide-y divide-slate-100">
            {storedProperties(objectType).map((property) => {
              const column = propertyColumn(property);
              const value = column ? row[column] : null;
              return (
                <div key={property.id} className="flex justify-between gap-4 py-1.5">
                  <dt className="text-fin-md text-slate-500">
                    {property.title}
                    {property.restricted && value == null && (
                      <span className="ml-1 text-slate-400">({t('ontology.restricted')})</span>
                    )}
                  </dt>
                  <dd
                    className={`text-fin-md text-slate-900 ${
                      alignsRight(property) ? 'tabular-nums' : ''
                    }`}
                  >
                    {formatValue(property, value)}
                  </dd>
                </div>
              );
            })}
          </dl>
        </Card>

        <div className="flex flex-col gap-4">
          {references.some((g) => g.rows.length > 0) && (
            <Card className="p-4">
              <h2 className="mb-2 text-fin-sm font-semibold uppercase tracking-wide text-slate-500">
                {t('ontology.references')}
              </h2>
              <dl className="divide-y divide-slate-100">
                {references
                  .filter((group) => group.rows.length > 0)
                  .map((group) => (
                    <div
                      key={`${group.traversal.link.id}-${group.traversal.reverse}`}
                      className="flex justify-between gap-4 py-1.5"
                    >
                      <dt className="text-fin-md text-slate-500">{group.traversal.title}</dt>
                      <dd className="min-w-0 text-right text-fin-md">
                        <NeighbourLink group={group} row={group.rows[0]!} />
                      </dd>
                    </div>
                  ))}
              </dl>
            </Card>
          )}

          {actions.length > 0 && (
            <Card className="p-4">
              <h2 className="mb-1 text-fin-sm font-semibold uppercase tracking-wide text-slate-500">
                {t('ontology.actions')}
              </h2>
              <p className="mb-2 text-fin-sm text-slate-400">{t('ontology.actionsHint')}</p>
              <ul className="flex flex-col gap-1.5">
                {actions.map((action) => {
                  const publisher = ontology.module(action.module);
                  return (
                    <li key={action.qualifiedId} className="text-fin-md">
                      <span className="text-slate-900">{action.title}</span>
                      <span className="text-slate-400">
                        {' · '}
                        {publisher ? t(publisher.titleKey) : action.module}
                        {action.adminOnly ? ` · ${t('ontology.adminOnly')}` : ''}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </div>
      </div>

      {filled.map((group) => (
        <NeighbourTable
          key={`${group.traversal.link.id}-${group.traversal.reverse}`}
          group={group}
          moreLabel={t('ontology.truncated')}
          crossLabel={t('ontology.crossesModule')}
        />
      ))}

      {emptyOnes.length > 0 && (
        <p className="text-fin-sm text-slate-400">
          {t('ontology.noneOf')}:{' '}
          {emptyOnes.map((group) => group.traversal.title.toLowerCase()).join(', ')}
        </p>
      )}
    </div>
  );
}

function NeighbourLink({ group, row }: { group: NeighbourGroup; row: Record<string, unknown> }) {
  const target = group.traversal.target;
  const href = explorerHref(target, row);
  const label = rowLabel(target, row);

  if (!href) return <span className="text-slate-900">{label}</span>;
  return (
    <Link href={href} className="text-brand-700 hover:underline">
      {label}
    </Link>
  );
}

/** A one-to-many link, rendered as the list it is. */
function NeighbourTable({
  group,
  moreLabel,
  crossLabel,
}: {
  group: NeighbourGroup;
  moreLabel: string;
  crossLabel: string;
}) {
  const target = group.traversal.target;
  const columns = previewProperties(target);

  return (
    <Card className="overflow-x-auto">
      <div className="flex flex-wrap items-baseline gap-2 px-4 pt-3">
        <h2 className="font-semibold text-slate-900">{group.traversal.title}</h2>
        <span className="text-fin-sm text-slate-400">
          {group.rows.length}
          {group.truncated ? `+ · ${moreLabel}` : ''}
        </span>
        {/* Worth saying out loud: this row is another module's answer. */}
        {group.traversal.crossesModule && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-fin-xs text-slate-500">
            {crossLabel}
          </span>
        )}
      </div>
      <table className="mt-2 w-full min-w-[32rem] text-fin-md">
        <thead>
          <tr className="border-b border-slate-200 text-left text-fin-sm text-slate-500">
            <th className="px-4 py-2 font-medium">{target.title}</th>
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
          {group.rows.map((row, index) => {
            const href = explorerHref(target, row);
            return (
              <tr key={href ?? index} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2">
                  {href ? (
                    <Link href={href} className="font-medium text-brand-700 hover:underline">
                      {rowLabel(target, row)}
                    </Link>
                  ) : (
                    rowLabel(target, row)
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
  );
}
