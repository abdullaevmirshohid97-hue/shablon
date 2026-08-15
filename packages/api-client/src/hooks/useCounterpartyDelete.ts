import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';

/** One kind of thing that points at a client, and how many of them there are. */
export interface CounterpartyReference {
  /** The ontology's object id — `tranzaksiya`, `faktura`, `jonatma`… */
  entity: string;
  count: number;
}

/** One line of the client register — see counterparty_directory (0035). */
export interface CounterpartyDirectoryRow {
  counterpartyId: string;
  name: string;
  phone?: string | null;
  managerId?: string | null;
  managerName?: string | null;
  currency: string;
  categories: string[];
  /** Gross movement through the account over the selected period. */
  turnover: number;
  entryCount: number;
  /**
   * Signed, all-time, and the figure that decides whether the account can be
   * closed: positive means the client owes, negative means the company does.
   * `totalDebt` is this clamped at zero, which is what the column shows.
   */
  balance: number;
  totalDebt: number;
  /** Warehouse and sales documents naming this client. */
  docCount: number;
}

/**
 * The client register, with the period's turnover beside each account.
 *
 * `range` null means all time. The balance ignores it either way — an account
 * is square or it is not, whatever window is on screen.
 */
export function useCounterpartyDirectory(
  supabase: SupabaseClient<Database>,
  orgId: string | undefined,
  range?: { start: string; end: string } | null,
) {
  return useQuery({
    queryKey: ['counterparty-directory', orgId, range?.start ?? null, range?.end ?? null],
    enabled: !!orgId,
    queryFn: async (): Promise<CounterpartyDirectoryRow[]> => {
      const { data, error } = await supabase.rpc('counterparty_directory', {
        target_org_id: orgId!,
        p_start: range?.start ?? null,
        p_end: range?.end ?? null,
      });

      if (error) throw error;
      return (data ?? []).map((row) => ({
        counterpartyId: row.counterparty_id,
        name: row.counterparty_name,
        phone: row.phone,
        managerId: row.manager_id,
        managerName: row.manager_name,
        currency: row.currency,
        categories: row.categories ?? [],
        turnover: Number(row.turnover),
        entryCount: Number(row.entry_count),
        balance: Number(row.balance),
        totalDebt: Number(row.total_debt),
        docCount: Number(row.doc_count),
      }));
    },
  });
}

/**
 * What would stand in the way of deleting this client.
 *
 * Asked before the button is pressed rather than after, so the screen can say
 * "14 ta tranzaksiya, 2 ta faktura" instead of offering a delete that is going
 * to be refused. The refusal still happens server-side — this is the courtesy,
 * not the rule.
 */
export function useCounterpartyReferences(
  supabase: SupabaseClient<Database>,
  orgId: string | undefined,
  counterpartyId: string | undefined,
) {
  return useQuery({
    queryKey: ['counterparty-references', orgId, counterpartyId],
    enabled: !!orgId && !!counterpartyId,
    queryFn: async (): Promise<CounterpartyReference[]> => {
      const { data, error } = await supabase.rpc('counterparty_references', {
        target_org_id: orgId!,
        target_id: counterpartyId!,
      });

      if (error) throw error;
      return (data ?? [])
        .map((row) => ({ entity: row.entity, count: Number(row.ref_count) }))
        .filter((row) => row.count > 0);
    },
  });
}

/**
 * Delete a client that never meant anything.
 *
 * Goes through the RPC rather than `.delete()` so the refusal arrives as a
 * sentence about the business — "unga bog'liq: 14 ta tranzaksiya" — instead of
 * a cascade tripping over 0014's posted-entry guard and reporting a document
 * number nobody asked about. See 0034.
 */
export function useDeleteCounterparty(supabase: SupabaseClient<Database>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orgId, counterpartyId }: { orgId: string; counterpartyId: string }) => {
      const { error } = await supabase.rpc('delete_counterparty', {
        target_org_id: orgId,
        target_id: counterpartyId,
      });
      if (error) throw error;
    },
    onSuccess: (_data, { orgId }) => {
      void queryClient.invalidateQueries({ queryKey: ['counterparties', orgId] });
      void queryClient.invalidateQueries({ queryKey: ['counterparty-journal', orgId] });
      void queryClient.invalidateQueries({ queryKey: ['counterparty-directory', orgId] });
    },
  });
}
