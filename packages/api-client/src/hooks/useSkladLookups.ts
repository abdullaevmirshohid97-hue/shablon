import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SkladLookup, SkladLookupKind } from '@mubosher/shared';
import type { Database } from '../database.types';
import { toSkladLookup } from '../mappers';

/** Fetches every kind in one request — callers group by `kind` client-side. */
export function useSkladLookups(supabase: SupabaseClient<Database>, orgId: string | undefined) {
  return useQuery({
    queryKey: ['sklad-lookups', orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<SkladLookup[]> => {
      const { data, error } = await supabase
        .from('sklad_lookups')
        .select('*')
        .eq('org_id', orgId!)
        .order('name');

      if (error) throw error;
      return data.map(toSkladLookup);
    },
  });
}

export function useCreateSkladLookup(supabase: SupabaseClient<Database>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orgId,
      kind,
      name,
    }: {
      orgId: string;
      kind: SkladLookupKind;
      name: string;
    }) => {
      const { error } = await supabase.from('sklad_lookups').insert({ org_id: orgId, kind, name });
      if (error) throw error;
    },
    onSuccess: (_data, { orgId }) => {
      void queryClient.invalidateQueries({ queryKey: ['sklad-lookups', orgId] });
    },
  });
}

export function useRenameSkladLookup(supabase: SupabaseClient<Database>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ lookupId, name }: { orgId: string; lookupId: string; name: string }) => {
      const { error } = await supabase.from('sklad_lookups').update({ name }).eq('id', lookupId);
      if (error) throw error;
    },
    onSuccess: (_data, { orgId }) => {
      void queryClient.invalidateQueries({ queryKey: ['sklad-lookups', orgId] });
    },
  });
}

export function useDeleteSkladLookup(supabase: SupabaseClient<Database>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ lookupId }: { orgId: string; lookupId: string }) => {
      const { error } = await supabase.from('sklad_lookups').delete().eq('id', lookupId);
      if (error) throw error;
    },
    onSuccess: (_data, { orgId }) => {
      void queryClient.invalidateQueries({ queryKey: ['sklad-lookups', orgId] });
    },
  });
}
