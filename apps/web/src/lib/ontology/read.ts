import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ontology,
  primaryKeyOf,
  propertyColumn,
  storedProperties,
  type ObjectTypeDef,
  type PropertyDef,
  type Traversal,
} from '@mubosher/shared';

/**
 * One reader for every object in the business.
 *
 * There is no table name, no column list and no join written anywhere below —
 * all of it comes out of the ontology, which is the point. Twenty-three object
 * types would otherwise be twenty-three nearly identical query files, each free
 * to drift from the others, and the twenty-fourth would be written by hand
 * again. Here a new object type becomes readable by being declared.
 *
 * The client is passed in rather than created: these run on the server with the
 * caller's own session, so row-level security is doing the access control. A
 * price row a storekeeper may not see comes back missing, not blank — that is
 * the database's answer and this code does not dress it up.
 */

export type ObjectRow = Record<string, unknown>;

/**
 * Everything a select has to name: the key, the stored properties, and the
 * foreign keys the links will need. The last group is the easy one to forget —
 * `invoice_id` is not a property anyone displays, but without it a sack cannot
 * find its invoice.
 */
export function selectColumnsFor(objectType: ObjectTypeDef): string[] {
  const columns = new Set<string>([primaryKeyOf(objectType)]);

  for (const property of storedProperties(objectType)) {
    const column = propertyColumn(property);
    if (column) columns.add(column);
  }

  for (const traversal of ontology.traversalsFrom(objectType.id)) {
    if (traversal.foreignKeyOnSource) columns.add(traversal.foreignKeyColumn);
  }

  return [...columns];
}

/**
 * The few properties worth showing when an object is one row in a list: what it
 * is called first, then its codes, then whatever else it has. Four at most —
 * beyond that a list stops being scannable and becomes a second detail page.
 */
export function previewProperties(objectType: ObjectTypeDef): PropertyDef[] {
  const stored = storedProperties(objectType);
  const title = stored.filter((p) => p.id === objectType.titleProperty);
  const codes = stored.filter((p) => p.id !== objectType.titleProperty && p.kind === 'code');
  const rest = stored.filter(
    (p) => p.id !== objectType.titleProperty && p.kind !== 'code' && p.kind !== 'ref',
  );

  return [...title, ...codes, ...rest].slice(0, 4);
}

/**
 * What to call one row in one line.
 *
 * The title property is not always stored — a lot is named by the product card
 * it came off, which is a join away — so this falls back rather than printing
 * an empty cell: the first code it has, then the first text, then the short
 * form of its key. A row with no name is still a row you can click.
 */
export function rowLabel(objectType: ObjectTypeDef, row: ObjectRow): string {
  const stored = storedProperties(objectType);
  const candidates = [
    stored.find((p) => p.id === objectType.titleProperty),
    ...stored.filter((p) => p.kind === 'code'),
    ...stored.filter((p) => p.kind === 'text'),
  ];

  for (const property of candidates) {
    if (!property) continue;
    const column = propertyColumn(property);
    const value = column ? row[column] : null;
    if (value != null && String(value).trim() !== '') return String(value);
  }

  const key = row[primaryKeyOf(objectType)];
  return key ? `${String(key).slice(0, 8)}…` : '—';
}

function scoped(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the query builder is generic over a schema this reader deliberately does not know
  query: any,
  objectType: ObjectTypeDef,
  orgId: string,
) {
  return objectType.orgScoped === false ? query : query.eq('org_id', orgId);
}

/** How many of these the caller can see. Null when the table refuses to say. */
export async function countObjects(
  supabase: SupabaseClient,
  objectType: ObjectTypeDef,
  orgId: string,
): Promise<number | null> {
  const { count, error } = await scoped(
    supabase.from(objectType.table).select(primaryKeyOf(objectType), {
      count: 'exact',
      head: true,
    }),
    objectType,
    orgId,
  );

  return error ? null : (count ?? null);
}

export interface ObjectListPage {
  objectType: ObjectTypeDef;
  rows: ObjectRow[];
  /** What went wrong, in the database's own words, rather than an empty list. */
  error?: string;
}

export async function loadObjectList(
  supabase: SupabaseClient,
  typeId: string,
  orgId: string,
  options: { search?: string; limit?: number } = {},
): Promise<ObjectListPage | null> {
  const objectType = ontology.objectType(typeId);
  if (!objectType) return null;

  let query = scoped(
    supabase.from(objectType.table).select(selectColumnsFor(objectType).join(',')),
    objectType,
    orgId,
  ).order('created_at', { ascending: false });

  const search = options.search?.trim();
  if (search) {
    const column = searchColumn(objectType);
    if (column) query = query.ilike(column, `%${search}%`);
  }

  const { data, error } = await query.limit(options.limit ?? 100);
  if (error) return { objectType, rows: [], error: error.message };

  return { objectType, rows: (data ?? []) as ObjectRow[] };
}

/** The one column a free-text search can honestly run against, if any. */
export function searchColumn(objectType: ObjectTypeDef): string | null {
  const stored = storedProperties(objectType);
  const named = stored.find((p) => p.id === objectType.titleProperty && p.kind !== 'ref');
  const code = stored.find((p) => p.kind === 'code');
  const text = stored.find((p) => p.kind === 'text');
  return propertyColumn(named ?? code ?? text ?? stored[0] ?? { id: '', title: '', kind: 'text' });
}

/** One traversal, followed: where it goes and what was found there. */
export interface NeighbourGroup {
  traversal: Traversal;
  rows: ObjectRow[];
  /** True when the list was cut short — there are more than these. */
  truncated: boolean;
}

export interface ObjectDetail {
  objectType: ObjectTypeDef;
  row: ObjectRow;
  neighbours: NeighbourGroup[];
}

const NEIGHBOUR_LIMIT = 25;

export async function loadObject(
  supabase: SupabaseClient,
  typeId: string,
  id: string,
  orgId: string,
): Promise<ObjectDetail | null> {
  const objectType = ontology.objectType(typeId);
  if (!objectType) return null;

  const { data, error } = await scoped(
    supabase
      .from(objectType.table)
      .select(selectColumnsFor(objectType).join(','))
      .eq(primaryKeyOf(objectType), id),
    objectType,
    orgId,
  ).maybeSingle();

  if (error || !data) return null;
  const row = data as ObjectRow;

  // Every link at once: they touch different tables and none of them depends on
  // another's answer, so waiting for them one after another is time spent for
  // nothing.
  const neighbours = await Promise.all(
    ontology
      .traversalsFrom(typeId)
      .map((traversal) => followTraversal(supabase, traversal, objectType, row, orgId)),
  );

  return { objectType, row, neighbours };
}

async function followTraversal(
  supabase: SupabaseClient,
  traversal: Traversal,
  source: ObjectTypeDef,
  row: ObjectRow,
  orgId: string,
): Promise<NeighbourGroup> {
  const target = traversal.target;
  const columns = selectColumnsFor(target).join(',');
  const empty: NeighbourGroup = { traversal, rows: [], truncated: false };

  // The key is on this row: read the far side by its own primary key.
  if (traversal.foreignKeyOnSource) {
    const value = row[traversal.foreignKeyColumn];
    if (value == null) return empty;

    const { data } = await scoped(
      supabase.from(target.table).select(columns).eq(primaryKeyOf(target), value),
      target,
      orgId,
    ).limit(1);

    return { traversal, rows: (data ?? []) as ObjectRow[], truncated: false };
  }

  // The key is on the far side: filter it by this row's own id.
  const ownKey = row[primaryKeyOf(source)];
  if (ownKey == null) return empty;

  const { data } = await scoped(
    supabase.from(target.table).select(columns).eq(traversal.foreignKeyColumn, ownKey),
    target,
    orgId,
  ).limit(NEIGHBOUR_LIMIT + 1);

  const rows = (data ?? []) as ObjectRow[];
  return {
    traversal,
    rows: rows.slice(0, NEIGHBOUR_LIMIT),
    truncated: rows.length > NEIGHBOUR_LIMIT,
  };
}

/** The object's own page, when it has one — `/hub/sotuv/faktura/123`. */
export function ownPageHref(objectType: ObjectTypeDef, row: ObjectRow): string | null {
  if (!objectType.href) return null;
  const key = row[primaryKeyOf(objectType)];
  return key ? objectType.href.replace(':id', String(key)) : null;
}

/** The explorer's own address for a row. */
export function explorerHref(objectType: ObjectTypeDef, row: ObjectRow): string | null {
  const key = row[primaryKeyOf(objectType)];
  return key ? `/hub/obyekt/${objectType.id}/${String(key)}` : null;
}
