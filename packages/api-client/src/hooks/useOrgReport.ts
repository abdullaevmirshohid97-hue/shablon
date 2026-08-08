import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';

export interface OrgReportRange {
  from?: string | null;
  to?: string | null;
}

export interface CounterpartyBalance {
  counterpartyId: string;
  name: string;
  balance: number;
}

export interface CategoryRow {
  categoryName: string;
  unit: string | null;
  kind: 'kirim' | 'chiqim';
  totalQuantity: number;
  totalAmount: number;
  entryCount: number;
}

export interface OverdueRow {
  counterpartyId: string;
  name: string;
  overdueAmount: number;
  overdueDate: string;
}

export interface DueSoonRow {
  transactionId: string;
  counterpartyName: string;
  description: string | null;
  amount: number;
  dueDate: string;
}

export interface ModuleRow {
  moduleName: string;
  counterpartyCount: number;
  totalKirim: number;
  totalChiqim: number;
  balance: number;
}

export interface OrgReport {
  totals: {
    totalKirim: number;
    totalChiqim: number;
    /** Movement on the receivable over the period. */
    net: number;
    /** Everything owed as of the period end — a position, not a flow. */
    totalDebt: number;
    /** Revenue for the period, off the sales accounts. */
    netRevenue: number;
  };
  byCategory: CategoryRow[];
  balances: CounterpartyBalance[];
  overdue: OverdueRow[];
  dueSoon: DueSoonRow[];
  modules: ModuleRow[];
}

/**
 * Every dashboard figure, aggregated in Postgres.
 *
 * This replaces `useOrgOverview`, which downloaded the org's entire
 * transaction table on every visit so the browser could sum it — fine at a
 * few hundred rows, unusable at fifty thousand. Six small result sets now
 * come back instead of the whole ledger.
 *
 * `categoryFilter` is pushed down to the database too: filtering client-side
 * would mean fetching everything again, which is the problem this solves.
 */
export function useOrgReport(
  supabase: SupabaseClient<Database>,
  orgId: string | undefined,
  range: OrgReportRange = {},
  categoryFilter?: string,
) {
  const queryClient = useQueryClient();
  const from = range.from ?? null;
  const to = range.to ?? null;
  const category = categoryFilter ?? null;
  const queryKey = ['org-report', orgId, from, to, category];

  const query = useQuery({
    queryKey,
    enabled: !!orgId,
    queryFn: async (): Promise<OrgReport> => {
      const [totals, categories, balances, overdue, dueSoon, modules] = await Promise.all([
        supabase.rpc('org_period_totals', { target_org_id: orgId!, p_from: from, p_to: to }),
        supabase.rpc('org_category_breakdown', {
          target_org_id: orgId!,
          p_from: from,
          p_to: to,
          p_category: category,
        }),
        supabase.rpc('counterparty_balances', { target_org_id: orgId!, p_as_of: to }),
        supabase.rpc('org_overdue_by_counterparty', {
          target_org_id: orgId!,
          p_as_of: null,
          p_category: category,
        }),
        supabase.rpc('org_due_soon', {
          target_org_id: orgId!,
          p_within_days: 7,
          p_category: category,
        }),
        supabase.rpc('org_module_breakdown', { target_org_id: orgId!, p_from: from, p_to: to }),
      ]);

      for (const r of [totals, categories, balances, overdue, dueSoon, modules]) {
        if (r.error) throw r.error;
      }

      const totalsRow = totals.data?.[0] ?? {
        total_kirim: 0,
        total_chiqim: 0,
        net: 0,
        total_debt: 0,
        net_revenue: 0,
      };

      return {
        totals: {
          totalKirim: Number(totalsRow.total_kirim),
          totalChiqim: Number(totalsRow.total_chiqim),
          net: Number(totalsRow.net),
          totalDebt: Number(totalsRow.total_debt),
          netRevenue: Number(totalsRow.net_revenue),
        },
        byCategory: (categories.data ?? []).map((r) => ({
          categoryName: r.category_name,
          unit: r.unit,
          kind: r.kind,
          totalQuantity: Number(r.total_quantity),
          totalAmount: Number(r.total_amount),
          entryCount: Number(r.entry_count),
        })),
        balances: (balances.data ?? []).map((r) => ({
          counterpartyId: r.counterparty_id,
          name: r.counterparty_name,
          balance: Number(r.balance),
        })),
        overdue: (overdue.data ?? []).map((r) => ({
          counterpartyId: r.counterparty_id,
          name: r.counterparty_name,
          overdueAmount: Number(r.overdue_amount),
          overdueDate: r.overdue_date,
        })),
        dueSoon: (dueSoon.data ?? []).map((r) => ({
          transactionId: r.transaction_id,
          counterpartyName: r.counterparty_name,
          description: r.description,
          amount: Number(r.amount),
          dueDate: r.due_date,
        })),
        modules: (modules.data ?? []).map((r) => ({
          moduleName: r.module_name,
          counterpartyCount: Number(r.counterparty_count),
          totalKirim: Number(r.total_kirim),
          totalChiqim: Number(r.total_chiqim),
          balance: Number(r.balance),
        })),
      };
    },
  });

  // A posting anywhere in the org changes these figures; the summary tables
  // behind them are maintained by trigger, so a refetch is all that is needed.
  useEffect(() => {
    if (!orgId) return;

    const channel = supabase
      .channel(`org-report:${orgId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions', filter: `org_id=eq.${orgId}` },
        () => void queryClient.invalidateQueries({ queryKey: ['org-report', orgId] }),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, orgId]);

  return query;
}
