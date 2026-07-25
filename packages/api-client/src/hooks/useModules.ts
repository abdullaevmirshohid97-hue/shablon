import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Module } from '@mubosher/shared';
import type { Database } from '../database.types';
import { toModule } from '../mappers';

export function useModules(supabase: SupabaseClient<Database>, orgId: string | undefined) {
  return useQuery({
    queryKey: ['modules', orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<Module[]> => {
      const { data, error } = await supabase
        .from('modules')
        .select('*')
        .eq('org_id', orgId!)
        .order('name');

      if (error) throw error;
      return data.map(toModule);
    },
  });
}

export function useCreateModule(supabase: SupabaseClient<Database>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orgId, name }: { orgId: string; name: string }) => {
      const { error } = await supabase.from('modules').insert({ org_id: orgId, name });
      if (error) throw error;
    },
    onSuccess: (_data, { orgId }) => {
      void queryClient.invalidateQueries({ queryKey: ['modules', orgId] });
    },
  });
}

/** Renames a module and cascades the new name into every counterparty tagged with it. */
export function useRenameModule(supabase: SupabaseClient<Database>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orgId,
      moduleId,
      oldName,
      newName,
    }: {
      orgId: string;
      moduleId: string;
      oldName: string;
      newName: string;
    }) => {
      const { error: updateError } = await supabase
        .from('modules')
        .update({ name: newName })
        .eq('id', moduleId);
      if (updateError) throw updateError;

      const { error: rpcError } = await supabase.rpc('rename_module_category', {
        target_org_id: orgId,
        old_name: oldName,
        new_name: newName,
      });
      if (rpcError) throw rpcError;
    },
    onSuccess: (_data, { orgId }) => {
      void queryClient.invalidateQueries({ queryKey: ['modules', orgId] });
    },
  });
}

/** Deletes a module and strips its tag from every counterparty that had it. */
export function useDeleteModule(supabase: SupabaseClient<Database>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orgId,
      moduleId,
      name,
    }: {
      orgId: string;
      moduleId: string;
      name: string;
    }) => {
      const { error: rpcError } = await supabase.rpc('remove_module_category', {
        target_org_id: orgId,
        name_to_remove: name,
      });
      if (rpcError) throw rpcError;

      const { error: deleteError } = await supabase.from('modules').delete().eq('id', moduleId);
      if (deleteError) throw deleteError;
    },
    onSuccess: (_data, { orgId }) => {
      void queryClient.invalidateQueries({ queryKey: ['modules', orgId] });
    },
  });
}
