import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { OBJECT_TYPES } from './objects';
import { LINKS } from './links';
import { primaryKeyOf, propertyColumn, storedProperties } from './registry';
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
