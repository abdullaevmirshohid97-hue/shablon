import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { OBJECT_TYPES } from './objects';
import { LINKS } from './links';
import { primaryKeyOf, propertyColumn, storedProperties } from './registry';
import { ontology } from './index';
import type { LinkDef, ObjectTypeDef } from './types';

/**
 * The ontology, checked against the migrations that actually built the schema.
 *
 * Everything else in this folder is internally consistent by construction — the
 * types see to that. What no type can catch is a table that says `qop_soni`
 * while the declaration says `pallet_soni`, or a period named `label` in one
 * place and `name` in the other. Both of those were here, and both produced a
 * file that compiled, passed every other test, and returned an error from
 * Postgres the first time anybody opened the page.
 *
 * So the SQL is the witness. It is parsed rather than connected to on purpose:
 * a test that needs a database is a test that gets skipped.
 */

const MIGRATIONS = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../database/supabase/migrations',
);

/** Table name -> the columns the migrations give it, in the end. */
function readSchema(): Map<string, Set<string>> {
  const tables = new Map<string, Set<string>>();
  const files = readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS, file), 'utf8');

    // create table [if not exists] <name> ( ... );
    for (const match of sql.matchAll(
      /create table (?:if not exists )?(\w+)\s*\(([\s\S]*?)\n\);/g,
    )) {
      const [, name = '', body = ''] = match;
      const columns = tables.get(name) ?? new Set<string>();
      for (const line of body.split('\n')) {
        const column = columnName(line);
        if (column) columns.add(column);
      }
      tables.set(name, columns);
    }

    // alter table <name> ... add column [if not exists] <col> ...;
    for (const match of sql.matchAll(/alter table (?:only )?(\w+)([\s\S]*?);/g)) {
      const [, name = '', body = ''] = match;
      const columns = tables.get(name);
      if (!columns) continue;

      for (const added of body.matchAll(/add column (?:if not exists )?(\w+)/g)) {
        if (added[1]) columns.add(added[1]);
      }
      for (const renamed of body.matchAll(/rename column (\w+) to (\w+)/g)) {
        const [, from = '', to = ''] = renamed;
        columns.delete(from);
        columns.add(to);
      }
      for (const dropped of body.matchAll(/drop column (?:if exists )?(\w+)/g)) {
        if (dropped[1]) columns.delete(dropped[1]);
      }
    }
  }

  return tables;
}

/**
 * The column a definition line declares, or null when the line is a constraint,
 * a comment, or the continuation of a generated expression.
 */
function columnName(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('--')) return null;

  const match = /^(\w+)\s+\w/.exec(trimmed);
  if (!match?.[1]) return null;

  const first = match[1].toLowerCase();
  if (['primary', 'unique', 'check', 'constraint', 'foreign', 'exclude'].includes(first)) {
    return null;
  }
  return match[1];
}

const schema = readSchema();

/**
 * The declarations widened to their interface.
 *
 * `as const` gives each entry its own literal type, which is what makes the ids
 * a union — and also what makes a field only some entries carry, like
 * `orgScoped`, invisible on the rest of the union. These tests ask about
 * exactly those fields, so they read the declarations as what they are declared
 * to satisfy.
 */
function objects(): [string, ObjectTypeDef][] {
  return OBJECT_TYPES.map((object) => [object.id, object]);
}

function links(): [string, LinkDef][] {
  return LINKS.map((link) => [link.id, link]);
}

describe('the ontology against the migrations', () => {
  it('parsed a schema worth checking against', () => {
    // A parser that silently found nothing, or one that swept up every word it
    // saw, would make every test below pass without checking anything.
    expect(schema.size).toBeGreaterThan(20);
    expect(schema.get('sklad_batches')?.has('qoldiq_dona')).toBe(true);
    expect(schema.get('accounting_periods')?.has('name')).toBe(true);
    expect(schema.get('accounting_periods')?.has('label')).toBe(false);
    // Renamed in 0026 — the old name must not survive the parse.
    expect(schema.get('sklad_batches')?.has('qop_soni')).toBe(true);
    expect(schema.get('sklad_batches')?.has('pallet_soni')).toBe(false);
  });

  it.each(objects())('%s names a real table', (_id, object) => {
    expect(schema.has(object.table), `${object.table} not in the migrations`).toBe(true);
  });

  it.each(objects())('%s stores every property it says it stores', (_id, object) => {
    const columns = schema.get(object.table);
    expect(columns).toBeDefined();

    for (const property of storedProperties(object)) {
      const column = propertyColumn(property)!;
      expect(columns!.has(column), `${object.table}.${column} (${property.id})`).toBe(true);
    }
  });

  it.each(objects())('%s is addressed by a column it has', (_id, object) => {
    expect(schema.get(object.table)?.has(primaryKeyOf(object))).toBe(true);
  });

  it.each(objects())('%s tells the truth about being scoped to an org', (_id, object) => {
    // Filtering on a column the table does not have is an error, not a wider
    // result — so this one has to be right rather than nearly right.
    expect(schema.get(object.table)?.has('org_id')).toBe(object.orgScoped !== false);
  });

  it.each(links())('%s points at a real column', (_id, link) => {
    const [table = '', column = ''] = link.foreignKey.split('.');
    expect(schema.has(table), `${table} not in the migrations`).toBe(true);
    expect(schema.get(table)?.has(column), `${link.foreignKey}`).toBe(true);
  });
});

/**
 * The warning that has to know the whole graph.
 *
 * Archiving a client is unconditional (0036), so what counterparty_references
 * produces is no longer a rule but a sentence: "bu mijozga bog'liq 14 ta
 * tranzaksiya, 2 ta faktura", shown before the operator hides a year of
 * trading. A table missing from it does not fail — it just quietly leaves
 * something out of the warning, which is the kind of omission nobody notices
 * until it matters.
 *
 * The list exists twice: once as links in the ontology, once as counted tables
 * in the SQL. So the SQL is read back and compared, and a module added later
 * that references clients fails this test until its table is counted.
 */
describe('the archive warning against the ontology', () => {
  const sql = readFileSync(join(MIGRATIONS, '0034_counterparty_delete.sql'), 'utf8');
  /** The statements alone — the header explains what a cascade would do, and
   * a test that reads the explanation as the code is testing prose. */
  const statements = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');

  /** The tables counterparty_references() counts, read out of its body. */
  function guardedTables(): Set<string> {
    const body =
      /create or replace function counterparty_references[\s\S]*?\$\$([\s\S]*?)\$\$/.exec(
        statements,
      )?.[1];
    expect(body, 'counterparty_references not found in 0034').toBeDefined();

    return new Set(
      [...body!.matchAll(/from\s+(\w+)\s+where\s+org_id\s*=\s*target_org_id/g)].map(
        (match) => match[1]!,
      ),
    );
  }

  /** Every table carrying a foreign key that points at a client. */
  function referencingTables(): Set<string> {
    return new Set(
      ontology
        .traversalsFrom('kontragent')
        // The key on counterparties itself points outward — that is the client's
        // manager, not something that would be orphaned by removing them.
        .filter((traversal) => !traversal.foreignKeyOnSource)
        .map((traversal) => traversal.link.foreignKey.split('.')[0]!),
    );
  }

  it('counts every table that references a client, and no others', () => {
    expect([...guardedTables()].sort()).toEqual([...referencingTables()].sort());
  });

  it('is checking a list worth checking', () => {
    // Four modules point at the client register; a guard covering one table
    // would pass an equality test against a broken ontology reading.
    expect(referencingTables().size).toBeGreaterThanOrEqual(5);
    expect(referencingTables()).toContain('transactions');
    expect(referencingTables()).toContain('sklad_invoices');
  });

  it('archives rather than deletes, so nothing has to be checked', () => {
    const archive = readFileSync(join(MIGRATIONS, '0036_counterparty_archive.sql'), 'utf8');

    // No hard delete of a client survives, so no rule about when one is safe
    // has to be argued about ever again.
    expect(archive).toMatch(/drop function if exists delete_counterparty/);
    expect(archive).toMatch(/set archived_at = now\(\)/);
    expect(archive).toMatch(/create or replace function restore_counterparty/);
  });

  it('leaves nothing that can erase a posted entry', () => {
    // 0035 opened a door in prevent_posted_delete so a settled client could
    // take their entries with them. Archiving removed the need, and 0036 shut
    // it. The last definition wins, so that is the one this reads.
    const files = readdirSync(MIGRATIONS)
      .filter((name) => name.endsWith('.sql'))
      .sort();

    const last = files
      .filter((file) =>
        /create or replace function prevent_posted_delete/.test(
          readFileSync(join(MIGRATIONS, file), 'utf8'),
        ),
      )
      .at(-1);

    expect(last).toBe('0036_counterparty_archive.sql');
    expect(readFileSync(join(MIGRATIONS, last!), 'utf8')).not.toMatch(/counterparty_purge/);
  });
});
