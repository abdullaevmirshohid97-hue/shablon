import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SkladBatchPrice } from '@mubosher/shared';
import type { Database } from '../database.types';
import { toSkladBatchPrice } from '../mappers';

/** Admin/owner-only per RLS — resolves to null for staff, not an error. */
export function useSkladBatchPrice(
  supabase: SupabaseClient<Database>,
  batchId: string | undefined,
) {
  return useQuery({
    queryKey: ['sklad-batch-price', batchId],
    enabled: !!batchId,
    queryFn: async (): Promise<SkladBatchPrice | null> => {
      const { data, error } = await supabase
        .from('sklad_batch_prices')
        .select('*')
        .eq('batch_id', batchId!)
        .maybeSingle();

      if (error) throw error;
      return data ? toSkladBatchPrice(data) : null;
    },
  });
}

type SkladBatchPriceInput = {
  orgId: string;
  batchId: string;
  pricePerKg?: number | null;
  pricePerPiece?: number | null;
  pricePerSet?: number | null;
  totalAmount?: number | null;
  purchaseCost?: number | null;
  profitPercent?: number | null;
  profitAmount?: number | null;
  currency?: string;
};

export function useUpsertSkladBatchPrice(supabase: SupabaseClient<Database>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SkladBatchPriceInput) => {
      const { error } = await supabase.from('sklad_batch_prices').upsert(
        {
          batch_id: input.batchId,
          org_id: input.orgId,
          price_per_kg: input.pricePerKg,
          price_per_piece: input.pricePerPiece,
          price_per_set: input.pricePerSet,
          total_amount: input.totalAmount,
          purchase_cost: input.purchaseCost,
          profit_percent: input.profitPercent,
          profit_amount: input.profitAmount,
          currency: input.currency,
        },
        { onConflict: 'batch_id' },
      );
      if (error) throw error;
    },
    onSuccess: (_data, { batchId }) => {
      void queryClient.invalidateQueries({ queryKey: ['sklad-batch-price', batchId] });
    },
  });
}
