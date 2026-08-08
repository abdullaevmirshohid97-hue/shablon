import { useQuery } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SkladAuditEntry, SkladStockRow } from '@mubosher/shared';
import type { Database } from '../database.types';
import { toSkladAuditEntry, toSkladStockRow } from '../mappers';

/**
 * Who changed which batch, product card or price, and what it said before.
 *
 * Reads the append-only log written by the triggers in 0021 — admin-only at
 * the RLS level too, not just by virtue of living on an admin page. Changes
 * the movement ledger makes to `qoldiq_dona` are filtered out at the trigger,
 * so this shows human edits only.
 */
export function useSkladAudit(
  supabase: SupabaseClient<Database>,
  orgId: string | undefined,
  limit = 100,
) {
  return useQuery({
    queryKey: ['sklad-audit', orgId, limit],
    enabled: !!orgId,
    queryFn: async (): Promise<SkladAuditEntry[]> => {
      const { data, error } = await supabase.rpc('list_sklad_audit', {
        target_org_id: orgId!,
        p_limit: limit,
      });
      if (error) throw error;
      return (data ?? []).map(toSkladAuditEntry);
    },
  });
}

/** What is on the shelves right now, per product card. */
export function useSkladStock(supabase: SupabaseClient<Database>, orgId: string | undefined) {
  return useQuery({
    queryKey: ['sklad-stock', orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<SkladStockRow[]> => {
      const { data, error } = await supabase.rpc('sklad_stock_by_item', {
        target_org_id: orgId!,
      });
      if (error) throw error;
      return (data ?? []).map(toSkladStockRow);
    },
  });
}
