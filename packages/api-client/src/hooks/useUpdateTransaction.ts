import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TransactionUpdateInput } from '@mubosher/shared';
import type { Database } from '../database.types';

/**
 * Edits an existing transaction in place (category/kind, quantity, amount,
 * source, description, date). Re-resolves debit/credit accounts from the
 * (possibly changed) category, same as create — so a Kirim<->Chiqim switch
 * during edit correctly flips which account is debited/credited. Because
 * the ledger's running balances are recomputed client-side from the full
 * transaction list on every fetch, updating this one row is enough for
 * Qarz/Haq/Jami/Qoldi to recalculate correctly for every later row too.
 */
export function useUpdateTransaction(supabase: SupabaseClient<Database>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: TransactionUpdateInput) => {
      const { data: category, error: categoryError } = await supabase
        .from('transaction_categories')
        .select('default_debit_account_id, default_credit_account_id')
        .eq('id', input.categoryId)
        .single();

      if (categoryError) throw categoryError;
      if (!category.default_debit_account_id || !category.default_credit_account_id) {
        throw new Error('Kategoriya uchun debet/kredit счётlari sozlanmagan');
      }

      const { error } = await supabase
        .from('transactions')
        .update({
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
        })
        .eq('id', input.id);

      if (error) throw error;
    },
    onSuccess: (_data, input) => {
      void queryClient.invalidateQueries({
        queryKey: ['transactions', input.orgId, input.counterpartyId],
      });
    },
  });
}
