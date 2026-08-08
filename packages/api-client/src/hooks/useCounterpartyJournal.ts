import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CounterpartyJournalRow } from '@mubosher/shared';
import type { Database } from '../database.types';

export interface CounterpartyJournalFilters {
  search?: string;
  managerId?: string;
  currency?: string;
  onlyDebtors?: boolean;
  onlyOverdue?: boolean;
}

/**
 * Every client on one line: who looks after them, what is past due, what is
 * owed in total, and in which currency.
 *
 * One source for both the debtors panel and the journal beneath it — the panel
 * is this list narrowed to the overdue, so the two can never disagree about a
 * figure the same person is reading twice on one screen.
 */
export function useCounterpartyJournal(
  supabase: SupabaseClient<Database>,
  orgId: string | undefined,
  filters: CounterpartyJournalFilters = {},
) {
  return useQuery({
    queryKey: ['counterparty-journal', orgId, filters],
    enabled: !!orgId,
    queryFn: async (): Promise<CounterpartyJournalRow[]> => {
      const { data, error } = await supabase.rpc('counterparty_journal', {
        target_org_id: orgId!,
        p_search: filters.search?.trim() || null,
        p_manager_id: filters.managerId || null,
        p_currency: filters.currency || null,
        p_only_debtors: filters.onlyDebtors ?? false,
        p_only_overdue: filters.onlyOverdue ?? false,
      });
      if (error) throw error;

      return (data ?? []).map((r) => ({
        counterpartyId: r.counterparty_id,
        name: r.counterparty_name,
        phone: r.phone,
        currency: r.currency,
        categories: r.categories ?? [],
        managerId: r.manager_id,
        managerName: r.manager_name,
        totalDebt: Number(r.total_debt),
        overdueAmount: Number(r.overdue_amount),
        overdueDate: r.overdue_date,
        nextDueDate: r.next_due_date,
        lastEntryAt: r.last_entry_at,
        entryCount: Number(r.entry_count),
      }));
    },
  });
}

/** The client's own details: who owns the relationship, what currency they
 * trade in, and whatever needed writing down about them. */
export function useUpdateCounterparty(supabase: SupabaseClient<Database>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      orgId: string;
      counterpartyId: string;
      name?: string;
      phone?: string | null;
      currency?: string | null;
      managerId?: string | null;
      notes?: string | null;
    }) => {
      const row: Record<string, unknown> = {};
      if (input.name !== undefined) row.name = input.name;
      if (input.phone !== undefined) row.phone = input.phone;
      if (input.currency !== undefined) row.currency = input.currency;
      if (input.managerId !== undefined) row.manager_id = input.managerId;
      if (input.notes !== undefined) row.notes = input.notes;

      const { error } = await supabase
        .from('counterparties')
        .update(row)
        .eq('id', input.counterpartyId);
      if (error) throw error;
    },
    onSuccess: (_data, { orgId, counterpartyId }) => {
      void queryClient.invalidateQueries({ queryKey: ['counterparty-journal', orgId] });
      void queryClient.invalidateQueries({ queryKey: ['counterparties', orgId] });
      void queryClient.invalidateQueries({ queryKey: ['counterparty', counterpartyId] });
    },
  });
}
