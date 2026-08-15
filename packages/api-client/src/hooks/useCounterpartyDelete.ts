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
    },
  });
}
