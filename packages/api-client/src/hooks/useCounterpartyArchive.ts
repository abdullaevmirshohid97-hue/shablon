import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';

/** One kind of thing that points at a client, and how many of them there are. */
export interface CounterpartyReference {
  /** The ontology's object id — `tranzaksiya`, `faktura`, `jonatma`… */
  entity: string;
  count: number;
}

/**
 * What this client is attached to.
 *
 * It no longer decides anything — archiving is unconditional — but it is what
 * the warning is made of. "Bu mijozda 14 ta tranzaksiya va 2 ta faktura bor"
 * is the sentence somebody needs before they hide a year of trading, and it is
 * a great deal more use than a generic "are you sure".
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

/** One line of the client register — see counterparty_directory (0036). */
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
  /** Signed: positive means the client owes, negative means the company does. */
  balance: number;
  totalDebt: number;
  /** Warehouse and sales documents naming this client. */
  docCount: number;
  /** When it was archived, or null while it is still an active client. */
  archivedAt?: string | null;
}

/**
 * The client register, with the period's turnover beside each account.
 *
 * `range` null means all time; the balance ignores it either way, since an
 * account's standing is not a property of the window being looked at.
 * `archived` switches the whole list over to what has been put away — the same
 * columns, so the archive is legible rather than a list of bare names.
 */
export function useCounterpartyDirectory(
  supabase: SupabaseClient<Database>,
  orgId: string | undefined,
  range?: { start: string; end: string } | null,
  archived = false,
) {
  return useQuery({
    queryKey: ['counterparty-directory', orgId, range?.start ?? null, range?.end ?? null, archived],
    enabled: !!orgId,
    queryFn: async (): Promise<CounterpartyDirectoryRow[]> => {
      const { data, error } = await supabase.rpc('counterparty_directory', {
        target_org_id: orgId!,
        p_start: range?.start ?? null,
        p_end: range?.end ?? null,
        p_archived: archived,
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
        archivedAt: row.archived_at,
      }));
    },
  });
}

/** Every list a client can disappear from or come back to. */
function invalidateCounterpartyLists(
  queryClient: ReturnType<typeof useQueryClient>,
  orgId: string,
) {
  void queryClient.invalidateQueries({ queryKey: ['counterparties', orgId] });
  void queryClient.invalidateQueries({ queryKey: ['counterparty-journal', orgId] });
  void queryClient.invalidateQueries({ queryKey: ['counterparty-directory', orgId] });
}

/**
 * Put a client away.
 *
 * Nothing is checked and nothing is destroyed: their entries, invoices and
 * despatches stay where they are, and the client stops appearing in the lists.
 * The warning shown beforehand is about visibility, not safety — which is the
 * whole reason there is no rule left to argue with. See 0036.
 */
export function useArchiveCounterparty(supabase: SupabaseClient<Database>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orgId, counterpartyId }: { orgId: string; counterpartyId: string }) => {
      const { error } = await supabase.rpc('archive_counterparty', {
        target_org_id: orgId,
        target_id: counterpartyId,
      });
      if (error) throw error;
    },
    onSuccess: (_data, { orgId }) => invalidateCounterpartyLists(queryClient, orgId),
  });
}

/** Bring one back, which is the reason archiving can be unconditional. */
export function useRestoreCounterparty(supabase: SupabaseClient<Database>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orgId, counterpartyId }: { orgId: string; counterpartyId: string }) => {
      const { error } = await supabase.rpc('restore_counterparty', {
        target_org_id: orgId,
        target_id: counterpartyId,
      });
      if (error) throw error;
    },
    onSuccess: (_data, { orgId }) => invalidateCounterpartyLists(queryClient, orgId),
  });
}
