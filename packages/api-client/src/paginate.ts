/**
 * PostgREST caps every response at the project's `max-rows` (1000 by default
 * on Supabase) and says nothing when it does — the request succeeds, the array
 * is just short. A ledger read that way produces a report that looks complete
 * and is not, which is worse than one that fails, so every full-table read
 * here pages through to the end instead of taking the first response as the
 * whole answer.
 */

const PAGE_SIZE = 1000;

/**
 * Runs `page` repeatedly with widening `.range()` bounds until a short page
 * comes back, and concatenates the results.
 *
 * The callback has to *build* the query rather than receive one: a
 * PostgrestFilterBuilder is a one-shot promise and cannot be awaited twice.
 */
export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize: number = PAGE_SIZE,
): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;

    rows.push(...data);
    if (data.length < pageSize) break;
  }

  return rows;
}
