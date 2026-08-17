import { useQuery } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';
import { toCounterparty } from '../mappers';

export function useCounterparties(supabase: SupabaseClient<Database>, orgId: string | undefined) {
  return useQuery({
    queryKey: ['counterparties', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('counterparties')
        .select('*')
        .eq('org_id', orgId!)
        // Every picker in the app reads this; an archived client must not be
        // offered for a new entry (0036).
        .is('archived_at', null)
        .order('name');

      if (error) throw error;
      return data.map(toCounterparty);
    },
  });
}
