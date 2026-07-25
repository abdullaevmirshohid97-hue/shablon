import { useQuery } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TransactionCategory } from '@mubosher/shared';
import type { Database } from '../database.types';
import { toTransactionCategory } from '../mappers';

export type CategoryKind = 'kirim' | 'chiqim' | 'other';

export interface CategoryWithKind extends TransactionCategory {
  kind: CategoryKind;
}

/**
 * Loads an org's transaction categories and classifies each as Kirim
 * (its default debit account is the receivable/"Клиенты" account, so
 * picking it increases what the counterparty owes) or Chiqim (the credit
 * side is receivable, decreasing the debt) — used to drive the two-button
 * Kirim/Chiqim entry form.
 */
export function useCategoriesWithKind(
  supabase: SupabaseClient<Database>,
  orgId: string | undefined,
) {
  return useQuery({
    queryKey: ['categories-with-kind', orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<CategoryWithKind[]> => {
      const [{ data: categories, error: catError }, { data: accounts, error: accError }] =
        await Promise.all([
          supabase.from('transaction_categories').select('*').eq('org_id', orgId!),
          supabase.from('accounts').select('*').eq('org_id', orgId!),
        ]);

      if (catError) throw catError;
      if (accError) throw accError;

      const accountsById = new Map(accounts.map((a) => [a.id, a]));

      return categories.map((c) => {
        const debitType = c.default_debit_account_id
          ? accountsById.get(c.default_debit_account_id)?.type
          : undefined;
        const creditType = c.default_credit_account_id
          ? accountsById.get(c.default_credit_account_id)?.type
          : undefined;

        const kind: CategoryKind =
          debitType === 'receivable' ? 'kirim' : creditType === 'receivable' ? 'chiqim' : 'other';

        return { ...toTransactionCategory(c), kind };
      });
    },
  });
}
