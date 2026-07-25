import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TransactionInput } from '@mubosher/shared';
import type { Database } from '../database.types';

/**
 * Inserts a transaction, resolving the debit/credit accounts from the
 * chosen category's defaults. `clientLocalId` is a client-generated UUID so
 * that offline mobile writes are safely retryable (unique constraint on
 * transactions.client_local_id makes a duplicate sync a no-op).
 */
export function useCreateTransaction(supabase: SupabaseClient<Database>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: TransactionInput) => {
      const { data: category, error: categoryError } = await supabase
        .from('transaction_categories')
        .select('default_debit_account_id, default_credit_account_id')
        .eq('id', input.categoryId)
        .single();

      if (categoryError) throw categoryError;
      if (!category.default_debit_account_id || !category.default_credit_account_id) {
        throw new Error('Kategoriya uchun debet/kredit счётlari sozlanmagan');
      }

      const { error } = await supabase.from('transactions').upsert(
        {
          org_id: input.orgId,
          counterparty_id: input.counterpartyId,
          category_id: input.categoryId,
          occurred_at: input.occurredAt,
          due_date: input.dueDate,
          description: input.description,
          quantity: input.quantity,
          unit: input.unit,
          quantity_kg: input.quantityKg,
          quantity_dona: input.quantityDona,
          debit_account_id: category.default_debit_account_id,
          debit_amount: input.amount,
          credit_account_id: category.default_credit_account_id,
          credit_amount: input.amount,
          currency: input.currency,
          source: input.source,
          client_local_id: input.clientLocalId,
        },
        { onConflict: 'client_local_id' },
      );

      if (error) throw error;
    },
    onSuccess: (_data, input) => {
      void queryClient.invalidateQueries({
        queryKey: ['transactions', input.orgId, input.counterpartyId],
      });
    },
  });
}
