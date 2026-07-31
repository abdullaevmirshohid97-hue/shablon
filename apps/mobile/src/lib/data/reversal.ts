import { supabase } from '../supabase';

/**
 * Undoes a posted entry the only way the server allows: by posting a mirror
 * entry that cancels it (0014_transaction_reversal.sql). A delete is refused
 * outright, so this is not one option among several — it is the operation.
 *
 * The date is left to the server (today), because the original's month is
 * often already closed and the correction has to land in the open one. On
 * web the date is editable; from a phone, "today" is the only sensible answer
 * and one fewer thing to get wrong while standing in a warehouse.
 */
export async function reverseTransaction(transactionId: string, reason?: string): Promise<void> {
  const { error } = await supabase.rpc('reverse_transaction', {
    p_transaction_id: transactionId,
    p_reversal_date: null,
    p_reason: reason ?? null,
  });

  if (error) throw new Error(error.message);
}
