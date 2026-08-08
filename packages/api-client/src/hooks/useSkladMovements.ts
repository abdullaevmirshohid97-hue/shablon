import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SkladMovement, SkladMovementKind } from '@mubosher/shared';
import type { Database } from '../database.types';
import { toSkladMovement } from '../mappers';

/** A batch's stock history, newest first, with the actor resolved to a name. */
export function useSkladMovements(supabase: SupabaseClient<Database>, batchId: string | undefined) {
  return useQuery({
    queryKey: ['sklad-movements', batchId],
    enabled: !!batchId,
    queryFn: async (): Promise<SkladMovement[]> => {
      const { data, error } = await supabase.rpc('list_sklad_movements', {
        p_batch_id: batchId!,
        p_limit: 100,
      });
      if (error) throw error;
      return (data ?? []).map(toSkladMovement);
    },
  });
}

export interface RecordMovementInput {
  orgId: string;
  batchId: string;
  kind: SkladMovementKind;
  /** Positive; the database applies the sign that the kind implies. */
  dona: number;
  kg?: number | null;
  occurredAt?: string | null;
  counterpartyId?: string | null;
  orderId?: string | null;
  note?: string | null;
}

/**
 * Records a receipt, shipment, return, write-off or stocktake line.
 *
 * The batch's remainder and status both follow from this — neither is written
 * by the app any more (0022). A movement that would take the batch below zero
 * is refused by the database, and the message it raises is meant to be shown
 * to the user as-is.
 */
export function useRecordSkladMovement(supabase: SupabaseClient<Database>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RecordMovementInput): Promise<string> => {
      const { data, error } = await supabase.rpc('record_sklad_movement', {
        p_batch_id: input.batchId,
        p_kind: input.kind,
        // A stocktake is the one kind whose direction the user chooses; for
        // every other the database derives it, so the sign here is noise.
        p_dona: input.kind === 'korrektirovka' ? input.dona : Math.abs(input.dona),
        p_kg: input.kg ?? null,
        p_occurred_at: input.occurredAt ?? null,
        p_counterparty_id: input.counterpartyId ?? null,
        p_order_id: input.orderId ?? null,
        p_note: input.note ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, { orgId, batchId }) => {
      void queryClient.invalidateQueries({ queryKey: ['sklad-movements', batchId] });
      void queryClient.invalidateQueries({ queryKey: ['sklad-batch-page', orgId] });
      void queryClient.invalidateQueries({ queryKey: ['sklad-batches', orgId] });
      void queryClient.invalidateQueries({ queryKey: ['sklad-stock', orgId] });
    },
  });
}
