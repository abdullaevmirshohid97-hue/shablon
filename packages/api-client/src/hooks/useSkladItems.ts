import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SkladItem } from '@mubosher/shared';
import type { Database } from '../database.types';
import { toSkladItem } from '../mappers';

export function useSkladItems(supabase: SupabaseClient<Database>, orgId: string | undefined) {
  return useQuery({
    queryKey: ['sklad-items', orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<SkladItem[]> => {
      const { data, error } = await supabase
        .from('sklad_items')
        .select('*')
        .eq('org_id', orgId!)
        .order('name');

      if (error) throw error;
      return data.map(toSkladItem);
    },
  });
}

type SkladItemInput = {
  orgId: string;
  artikul?: string | null;
  kod?: string | null;
  name: string;
  productTypeId?: string | null;
  yarnTypeId?: string | null;
  gsm?: number | null;
  sizeId?: string | null;
  sortId?: string | null;
  colorId?: string | null;
  pantoneId?: string | null;
};

function toRow(input: SkladItemInput) {
  return {
    artikul: input.artikul,
    kod: input.kod,
    name: input.name,
    product_type_id: input.productTypeId,
    yarn_type_id: input.yarnTypeId,
    gsm: input.gsm,
    size_id: input.sizeId,
    sort_id: input.sortId,
    color_id: input.colorId,
    pantone_id: input.pantoneId,
  };
}

export function useCreateSkladItem(supabase: SupabaseClient<Database>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SkladItemInput) => {
      const { error } = await supabase
        .from('sklad_items')
        .insert({ org_id: input.orgId, ...toRow(input) });
      if (error) throw error;
    },
    onSuccess: (_data, { orgId }) => {
      void queryClient.invalidateQueries({ queryKey: ['sklad-items', orgId] });
      void queryClient.invalidateQueries({ queryKey: ['sklad-batch-page', orgId] });
      void queryClient.invalidateQueries({ queryKey: ['sklad-stock', orgId] });
    },
  });
}

export function useUpdateSkladItem(supabase: SupabaseClient<Database>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemId, ...input }: SkladItemInput & { itemId: string }) => {
      const { error } = await supabase.from('sklad_items').update(toRow(input)).eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: (_data, { orgId }) => {
      void queryClient.invalidateQueries({ queryKey: ['sklad-items', orgId] });
      void queryClient.invalidateQueries({ queryKey: ['sklad-batch-page', orgId] });
      void queryClient.invalidateQueries({ queryKey: ['sklad-stock', orgId] });
    },
  });
}

export function useDeleteSkladItem(supabase: SupabaseClient<Database>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemId }: { orgId: string; itemId: string }) => {
      const { error } = await supabase.from('sklad_items').delete().eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: (_data, { orgId }) => {
      void queryClient.invalidateQueries({ queryKey: ['sklad-items', orgId] });
      void queryClient.invalidateQueries({ queryKey: ['sklad-batch-page', orgId] });
      void queryClient.invalidateQueries({ queryKey: ['sklad-stock', orgId] });
    },
  });
}
