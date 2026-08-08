import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SkladOrder, SkladOrderStatus } from '@mubosher/shared';
import type { Database } from '../database.types';
import { toSkladOrder } from '../mappers';

export function useSkladOrders(supabase: SupabaseClient<Database>, orgId: string | undefined) {
  return useQuery({
    queryKey: ['sklad-orders', orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<SkladOrder[]> => {
      const { data, error } = await supabase
        .from('sklad_orders')
        .select('*')
        .eq('org_id', orgId!)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data.map(toSkladOrder);
    },
  });
}

type SkladOrderInput = {
  orgId: string;
  orderNo?: string | null;
  orderName?: string | null;
  counterpartyId?: string | null;
  // 0024. Undefined means "leave alone" — the order screen and the batch
  // modal both write this type, and the batch modal knows nothing about
  // managers or deadlines.
  managerId?: string | null;
  deadline?: string | null;
  status?: SkladOrderStatus;
  notes?: string | null;
};

/** Only the keys the caller actually supplied, so a partial edit stays partial. */
function toOrderRow(input: SkladOrderInput) {
  const row: Record<string, unknown> = {
    order_no: input.orderNo,
    order_name: input.orderName,
    counterparty_id: input.counterpartyId,
  };
  if (input.managerId !== undefined) row.manager_id = input.managerId;
  if (input.deadline !== undefined) row.deadline = input.deadline;
  if (input.status !== undefined) row.status = input.status;
  if (input.notes !== undefined) row.notes = input.notes;
  return row;
}

export function useCreateSkladOrder(supabase: SupabaseClient<Database>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SkladOrderInput) => {
      const { data, error } = await supabase
        .from('sklad_orders')
        .insert({ org_id: input.orgId, ...toOrderRow(input) })
        .select('*')
        .single();
      if (error) throw error;
      return toSkladOrder(data);
    },
    onSuccess: (_data, { orgId }) => {
      void queryClient.invalidateQueries({ queryKey: ['sklad-orders', orgId] });
      void queryClient.invalidateQueries({ queryKey: ['sklad-batch-page', orgId] });
    },
  });
}

/** One order, for the screen the whole factory works from. */
export function useSkladOrder(supabase: SupabaseClient<Database>, orderId: string | undefined) {
  return useQuery({
    queryKey: ['sklad-order', orderId],
    enabled: !!orderId,
    queryFn: async (): Promise<SkladOrder> => {
      const { data, error } = await supabase
        .from('sklad_orders')
        .select('*')
        .eq('id', orderId!)
        .single();
      if (error) throw error;
      return toSkladOrder(data);
    },
  });
}

export function useDeleteSkladOrder(supabase: SupabaseClient<Database>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId }: { orgId: string; orderId: string }) => {
      const { error } = await supabase.from('sklad_orders').delete().eq('id', orderId);
      if (error) throw error;
    },
    onSuccess: (_data, { orgId }) => {
      void queryClient.invalidateQueries({ queryKey: ['sklad-orders', orgId] });
      void queryClient.invalidateQueries({ queryKey: ['sklad-batch-page', orgId] });
    },
  });
}

export function useUpdateSkladOrder(supabase: SupabaseClient<Database>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, ...input }: SkladOrderInput & { orderId: string }) => {
      const { error } = await supabase
        .from('sklad_orders')
        .update(toOrderRow(input))
        .eq('id', orderId);
      if (error) throw error;
    },
    onSuccess: (_data, { orgId, orderId }) => {
      void queryClient.invalidateQueries({ queryKey: ['sklad-orders', orgId] });
      void queryClient.invalidateQueries({ queryKey: ['sklad-order', orderId] });
      void queryClient.invalidateQueries({ queryKey: ['sklad-order-summary', orgId] });
      void queryClient.invalidateQueries({ queryKey: ['sklad-batch-page', orgId] });
    },
  });
}
