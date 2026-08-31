import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@mubosher/api-client';
import type { OverdueDebt } from '@mubosher/shared';

export type { OverdueDebt as CounterpartyDebt };

/**
 * Who is late, and by how much — for the badge on the client cards in
 * /clients and /dashboard/[category].
 *
 * Read from `org_overdue_by_counterparty` rather than computed here. The
 * version before this downloaded the org's transactions and ran the shared
 * rule over them, but it fetched only the rows carrying a due date — and since
 * a deadline is recorded against the payment leg, that subset is nothing but
 * credits. The balance it derived was therefore negative for every client,
 * every client read as settled, and the badge silently never appeared. The
 * aggregate answers the same question in Postgres, correctly (0038), without
 * moving the ledger across the wire to do it.
 */
export async function getOverdueDebts(
  supabase: SupabaseClient<Database>,
  orgId: string,
  category?: string,
): Promise<Record<string, OverdueDebt>> {
  const { data, error } = await supabase.rpc('org_overdue_by_counterparty', {
    target_org_id: orgId,
    p_as_of: null,
    p_category: category ?? null,
  });

  // A missing badge is not worth a broken directory: the page renders without
  // it rather than failing on a panel that decorates the list.
  if (error || !data) return {};

  const result: Record<string, OverdueDebt> = {};
  for (const row of data) {
    if (!row.overdue_date) continue;
    result[row.counterparty_id] = {
      overdueAmount: Number(row.overdue_amount),
      overdueDate: row.overdue_date,
    };
  }

  return result;
}
