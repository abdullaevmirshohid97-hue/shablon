import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';
import { toLedgerTransaction } from '../mappers';
import { fetchAllRows } from '../paginate';

/**
 * Loads a counterparty's transactions (joined with account types so the
 * caller can feed them straight into computeRunningBalance) and keeps them
 * live via Supabase Realtime — this is what makes the web dashboard update
 * the instant a mobile entry syncs.
 */
export function useTransactions(
  supabase: SupabaseClient<Database>,
  orgId: string | undefined,
  counterpartyId: string | undefined,
) {
  const queryClient = useQueryClient();
  const queryKey = ['transactions', orgId, counterpartyId];

  const query = useQuery({
    queryKey,
    enabled: !!orgId && !!counterpartyId,
    queryFn: async () => {
      // Paged rather than a single select: PostgREST truncates at the
      // project's max-rows without reporting anything, and a ledger silently
      // missing its oldest entries restates every balance below it.
      const [accounts, categories, txs] = await Promise.all([
        fetchAllRows((from, to) =>
          supabase.from('accounts').select('*').eq('org_id', orgId!).order('id').range(from, to),
        ),
        fetchAllRows((from, to) =>
          supabase
            .from('transaction_categories')
            .select('*')
            .eq('org_id', orgId!)
            .order('id')
            .range(from, to),
        ),
        fetchAllRows((from, to) =>
          supabase
            .from('transactions')
            .select('*')
            .eq('counterparty_id', counterpartyId!)
            .order('occurred_at')
            .order('created_at')
            .range(from, to),
        ),
      ]);

      const accountsById = new Map(accounts.map((a) => [a.id, a]));
      const categoriesById = new Map(categories.map((c) => [c.id, c]));
      return txs.map((t) => toLedgerTransaction(t, accountsById, categoriesById));
    },
  });

  useEffect(() => {
    if (!counterpartyId) return;

    const channel = supabase
      .channel(`transactions:${counterpartyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `counterparty_id=eq.${counterpartyId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, counterpartyId]);

  return query;
}
