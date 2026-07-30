/**
 * Normalises a PostgREST embedded relation to a single record.
 *
 * PostgREST serialises a to-one embed (`memberships?select=organizations(name)`)
 * as an **object**, but `database.types.ts` is hand-maintained and carries
 * `Relationships: []`, so supabase-js types every embed as an array. Code that
 * followed the types and wrote `row.organizations?.[0]` therefore compiled
 * cleanly and read `undefined` at runtime — the org name never rendered, and
 * every joined Sklad column (item name, order, price) came back blank.
 *
 * Accepting both shapes keeps this correct today and after the types are
 * regenerated properly, which would flip the declared shape under it.
 */
export function one<T>(value: T | T[] | null | undefined): T | null {
  if (value === null || value === undefined) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}
