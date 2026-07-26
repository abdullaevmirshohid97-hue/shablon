import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SkladBatch, SkladBatchStatus } from '@mubosher/shared';
import type { Database } from '../database.types';
import { toSkladBatch, type SkladBatchEmbeddedRow } from '../mappers';

const EMBEDDED_SELECT =
  '*, sklad_items(name, artikul), sklad_orders(order_no, order_name, counterparties(name)), sklad_batch_prices(*)';

/** One request, embedding item/order/counterparty/price — see SkladBatchEmbeddedRow in mappers.ts. */
export function useSkladBatches(supabase: SupabaseClient<Database>, orgId: string | undefined) {
  return useQuery({
    queryKey: ['sklad-batches', orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<SkladBatch[]> => {
      const { data, error } = await supabase
        .from('sklad_batches')
        .select(EMBEDDED_SELECT)
        .eq('org_id', orgId!)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data as unknown as SkladBatchEmbeddedRow[]).map(toSkladBatch);
    },
  });
}

type SkladBatchInput = {
  orgId: string;
  itemId: string;
  orderId?: string | null;
  bruttoKg?: number | null;
  nettoKg?: number | null;
  donaSoni?: number | null;
  naborSoni?: number | null;
  palletSoni?: number | null;
  qoldiqDona?: number | null;
  ishlabChiqarilganSana?: string | null;
  omborgaKirganSana?: string;
  status?: SkladBatchStatus;
  qcCheckedBy?: string | null;
  qcCheckedAt?: string | null;
  defectType?: string | null;
  defectQty?: number | null;
  notes?: string | null;
  locationSector?: string | null;
  locationRow?: string | null;
  locationRack?: string | null;
  locationShelf?: string | null;
};

function toRow(input: SkladBatchInput) {
  return {
    order_id: input.orderId,
    brutto_kg: input.bruttoKg,
    netto_kg: input.nettoKg,
    dona_soni: input.donaSoni,
    nabor_soni: input.naborSoni,
    pallet_soni: input.palletSoni,
    qoldiq_dona: input.qoldiqDona,
    ishlab_chiqarilgan_sana: input.ishlabChiqarilganSana,
    omborga_kirgan_sana: input.omborgaKirganSana,
    status: input.status,
    qc_checked_by: input.qcCheckedBy,
    qc_checked_at: input.qcCheckedAt,
    defect_type: input.defectType,
    defect_qty: input.defectQty,
    notes: input.notes,
    location_sector: input.locationSector,
    location_row: input.locationRow,
    location_rack: input.locationRack,
    location_shelf: input.locationShelf,
  };
}

export function useCreateSkladBatch(supabase: SupabaseClient<Database>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SkladBatchInput): Promise<string> => {
      const { data, error } = await supabase
        .from('sklad_batches')
        .insert({ org_id: input.orgId, item_id: input.itemId, ...toRow(input) })
        .select('id')
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (_data, { orgId }) => {
      void queryClient.invalidateQueries({ queryKey: ['sklad-batches', orgId] });
    },
  });
}

export function useUpdateSkladBatch(supabase: SupabaseClient<Database>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ batchId, ...input }: SkladBatchInput & { batchId: string }) => {
      const { error } = await supabase
        .from('sklad_batches')
        .update({ item_id: input.itemId, ...toRow(input) })
        .eq('id', batchId);
      if (error) throw error;
    },
    onSuccess: (_data, { orgId }) => {
      void queryClient.invalidateQueries({ queryKey: ['sklad-batches', orgId] });
    },
  });
}

export function useDeleteSkladBatch(supabase: SupabaseClient<Database>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ batchId }: { orgId: string; batchId: string }) => {
      const { error } = await supabase.from('sklad_batches').delete().eq('id', batchId);
      if (error) throw error;
    },
    onSuccess: (_data, { orgId }) => {
      void queryClient.invalidateQueries({ queryKey: ['sklad-batches', orgId] });
    },
  });
}
