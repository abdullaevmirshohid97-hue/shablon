import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';
import { toLedgerTransaction } from '../mappers';

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
      const [{ data: accounts, error: accountsError }, { data: txs, error: txError }] =
        await Promise.all([
          supabase.from('accounts').select('*').eq('org_id', orgId!),
          supabase
            .from('transactions')
            .select('*')
            .eq('counterparty_id', counterpartyId!)
            .order('occurred_at')
            .order('created_at'),
        ]);

      if (accountsError) throw accountsError;
      if (txError) throw txError;

      const accountsById = new Map(accounts.map((a) => [a.id, a]));
      return txs.map((t) => toLedgerTransaction(t, accountsById));
    },
  });

  useEffect(() => {
    if (!counterpartyId) return;

    const channel = supabase
      .channel(`transactions:${counterpartyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions', filter: `counterparty_id=eq.${counterpartyId}` },
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
