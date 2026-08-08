import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SkladOrder } from '@mubosher/shared';
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
};

export function useCreateSkladOrder(supabase: SupabaseClient<Database>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SkladOrderInput) => {
      const { data, error } = await supabase
        .from('sklad_orders')
        .insert({
          org_id: input.orgId,
          order_no: input.orderNo,
          order_name: input.orderName,
          counterparty_id: input.counterpartyId,
        })
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
        .update({
          order_no: input.orderNo,
          order_name: input.orderName,
          counterparty_id: input.counterpartyId,
        })
        .eq('id', orderId);
      if (error) throw error;
    },
    onSuccess: (_data, { orgId }) => {
      void queryClient.invalidateQueries({ queryKey: ['sklad-orders', orgId] });
      void queryClient.invalidateQueries({ queryKey: ['sklad-batch-page', orgId] });
    },
  });
}
