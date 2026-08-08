import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SkladBatchPage, SkladBatchStatus } from '@mubosher/shared';
import type { Database } from '../database.types';
import { toSkladBatchRow } from '../mappers';

export interface SkladBatchFilters {
  search?: string;
  productTypeId?: string;
  colorId?: string;
  pantoneId?: string;
  sizeId?: string;
  sortId?: string;
  gsm?: string;
  orderId?: string;
  counterpartyId?: string;
  status?: SkladBatchStatus | '';
  from?: string;
  to?: string;
  inStockOnly?: boolean;
}

export const SKLAD_PAGE_SIZE = 50;

/** '' is what an unselected <select> gives us; the RPC wants null. */
function nullable(value: string | undefined): string | null {
  return value ? value : null;
}

/**
 * One page of the warehouse list, filtered and totalled in Postgres.
 *
 * Replaces useSkladBatches for the list screen, which fetched every batch the
 * org had and filtered in the browser. That hook stays for the edit form,
 * which legitimately wants the raw record with its lookup ids.
 *
 * The totals come back on each row as window aggregates over the whole
 * filtered set (see 0023), so the footer figures are for every matching batch,
 * not just the fifty on screen.
 */
export function useSkladBatchPage(
  supabase: SupabaseClient<Database>,
  orgId: string | undefined,
  filters: SkladBatchFilters = {},
  page = 0,
) {
  const queryClient = useQueryClient();
  const queryKey = ['sklad-batch-page', orgId, filters, page];

  const query = useQuery({
    queryKey,
    enabled: !!orgId,
    queryFn: async (): Promise<SkladBatchPage> => {
      const { data, error } = await supabase.rpc('sklad_batch_page', {
        target_org_id: orgId!,
        p_search: nullable(filters.search?.trim()),
        p_product_type_id: nullable(filters.productTypeId),
        p_color_id: nullable(filters.colorId),
        p_pantone_id: nullable(filters.pantoneId),
        p_size_id: nullable(filters.sizeId),
        p_sort_id: nullable(filters.sortId),
        p_gsm: filters.gsm ? Number(filters.gsm) : null,
        p_order_id: nullable(filters.orderId),
        p_counterparty_id: nullable(filters.counterpartyId),
        p_status: filters.status ? filters.status : null,
        p_from: nullable(filters.from),
        p_to: nullable(filters.to),
        p_in_stock_only: filters.inStockOnly ?? false,
        p_limit: SKLAD_PAGE_SIZE,
        p_offset: page * SKLAD_PAGE_SIZE,
      });

      if (error) throw error;

      const rows = data ?? [];
      const first = rows[0];

      return {
        rows: rows.map(toSkladBatchRow),
        totals: {
          count: first ? Number(first.total_count) : 0,
          nettoKg: Number(first?.sum_netto_kg ?? 0),
          qoldiqDona: Number(first?.sum_qoldiq_dona ?? 0),
          qoldiqKg: Number(first?.sum_qoldiq_kg ?? 0),
          totalAmount: first?.sum_total_amount != null ? Number(first.sum_total_amount) : null,
          currency: first?.sum_currency ?? null,
        },
      };
    },
    // A filter change is a new query key, and the previous page's data is a
    // better thing to show for the half-second it takes than an empty table.
    placeholderData: (previous) => previous,
  });

  // Two storekeepers work the same shelves. A batch or a movement written on
  // one screen has to appear on the other without a manual refresh — which is
  // why 0021/0022 add both tables to the realtime publication.
  useEffect(() => {
    if (!orgId) return;

    const channel = supabase
      .channel(`sklad:${orgId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sklad_batches', filter: `org_id=eq.${orgId}` },
        () => void queryClient.invalidateQueries({ queryKey: ['sklad-batch-page', orgId] }),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sklad_movements', filter: `org_id=eq.${orgId}` },
        () => void queryClient.invalidateQueries({ queryKey: ['sklad-batch-page', orgId] }),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, orgId, queryClient]);

  return query;
}
