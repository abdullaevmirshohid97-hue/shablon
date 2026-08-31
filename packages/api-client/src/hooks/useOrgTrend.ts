import { useQuery } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';

export interface CurrencyTotalsRow {
  currency: string;
  totalKirim: number;
  totalChiqim: number;
  net: number;
  /** A position, at the period end — not a flow like the three above it. */
  totalDebt: number;
  entryCount: number;
  counterpartyCount: number;
}

export interface MonthlyPoint {
  /** First day of the month, ISO. */
  month: string;
  totalKirim: number;
  totalChiqim: number;
  /** What was owed at the end of that month. */
  closingDebt: number;
}

/**
 * What each currency did, without converting any of it (0039).
 *
 * Every other aggregate in the app reports in the org's base currency, which
 * is the only way to add a dollar entry to a sum entry. That also means the
 * dollar side of the book has never been readable as dollars — this is the
 * view that reads it. Nothing here is comparable across rows, by design.
 */
export function useOrgCurrencyTotals(
  supabase: SupabaseClient<Database>,
  orgId: string | undefined,
  range: { from?: string | null; to?: string | null } = {},
  category?: string,
) {
  return useQuery({
    queryKey: ['org-currency-totals', orgId, range.from, range.to, category],
    enabled: !!orgId,
    queryFn: async (): Promise<CurrencyTotalsRow[]> => {
      const { data, error } = await supabase.rpc('org_currency_totals', {
        target_org_id: orgId!,
        p_from: range.from ?? null,
        p_to: range.to ?? null,
        p_category: category ?? null,
      });
      if (error) throw error;

      return (data ?? []).map((r) => ({
        currency: r.currency,
        totalKirim: Number(r.total_kirim),
        totalChiqim: Number(r.total_chiqim),
        net: Number(r.net),
        totalDebt: Number(r.total_debt),
        entryCount: Number(r.entry_count),
        counterpartyCount: Number(r.counterparty_count),
      }));
    },
  });
}

/**
 * The last N months: turnover in each and the debt at the end of each.
 *
 * `currency` null gives the consolidated base-currency view; a code gives that
 * currency's own figures, unconverted. Months with no activity come back as
 * zeros rather than as gaps, so a chart drawn from this has an even axis.
 */
export function useOrgMonthlySeries(
  supabase: SupabaseClient<Database>,
  orgId: string | undefined,
  options: { months?: number; currency?: string | null; category?: string } = {},
) {
  const { months = 12, currency = null, category } = options;

  return useQuery({
    queryKey: ['org-monthly-series', orgId, months, currency, category],
    enabled: !!orgId,
    queryFn: async (): Promise<MonthlyPoint[]> => {
      const { data, error } = await supabase.rpc('org_monthly_series', {
        target_org_id: orgId!,
        p_months: months,
        p_currency: currency,
        p_category: category ?? null,
      });
      if (error) throw error;

      return (data ?? []).map((r) => ({
        month: r.month,
        totalKirim: Number(r.total_kirim),
        totalChiqim: Number(r.total_chiqim),
        closingDebt: Number(r.closing_debt),
      }));
    },
  });
}
