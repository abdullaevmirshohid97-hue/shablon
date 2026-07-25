import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { LedgerTransaction } from '@mubosher/shared';
import type { Database } from '../database.types';
import { toLedgerTransaction, toCounterparty } from '../mappers';

export interface OrgOverviewCounterparty {
  id: string;
  name: string;
  categories: string[];
}

/**
 * One fetch that powers every "at a glance" dashboard: the main overview
 * (all clients) and every module page (clients filtered by category) both
 * derive from this same counterparties+transactions pair, client-side —
 * so switching modules is instant instead of a fresh round trip per click.
 */
export function useOrgOverview(supabase: SupabaseClient<Database>, orgId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['org-overview', orgId];

  const query = useQuery({
    queryKey,
    enabled: !!orgId,
    queryFn: async (): Promise<{
      counterparties: OrgOverviewCounterparty[];
      transactions: LedgerTransaction[];
    }> => {
      const [
        { data: counterparties, error: counterpartiesError },
        { data: accounts, error: accountsError },
        { data: categories, error: categoriesError },
        { data: txs, error: txError },
      ] = await Promise.all([
        supabase
          .from('counterparties')
          .select('id, org_id, name, phone, categories, notes, currency, created_at')
          .eq('org_id', orgId!),
        supabase.from('accounts').select('*').eq('org_id', orgId!),
        supabase.from('transaction_categories').select('*').eq('org_id', orgId!),
        supabase
          .from('transactions')
          .select('*')
          .eq('org_id', orgId!)
          .order('occurred_at')
          .order('created_at'),
      ]);

      if (counterpartiesError) throw counterpartiesError;
      if (accountsError) throw accountsError;
      if (categoriesError) throw categoriesError;
      if (txError) throw txError;

      const accountsById = new Map(accounts.map((a) => [a.id, a]));
      const categoriesById = new Map(categories.map((c) => [c.id, c]));

      return {
        counterparties: counterparties.map(toCounterparty),
        transactions: txs.map((t) => toLedgerTransaction(t, accountsById, categoriesById)),
      };
    },
  });

  useEffect(() => {
    if (!orgId) return;

    const channel = supabase
      .channel(`org-overview:${orgId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions', filter: `org_id=eq.${orgId}` },
        () => void queryClient.invalidateQueries({ queryKey }),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'counterparties', filter: `org_id=eq.${orgId}` },
        () => void queryClient.invalidateQueries({ queryKey }),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, orgId]);

  return query;
}
