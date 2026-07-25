'use client';

import { useMemo } from 'react';
import { useOrgOverview, useModules } from '@mubosher/api-client';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { LedgerAnalytics } from './LedgerAnalytics';
import { TopDebtors } from './TopDebtors';
import { ModuleBreakdownTable } from './ModuleBreakdownTable';

/**
 * Drives the "at a glance" dashboard: the main overview (all clients) and
 * every module page (clients filtered by category) both render this same
 * component, just with a different `categoryFilter` — one data fetch
 * (`useOrgOverview`) that Next.js's client-side router cache keeps warm
 * across navigations between them. The main overview additionally shows a
 * per-module breakdown table (skipped on module pages — a module doesn't
 * need a table of itself).
 */
export function OverviewAnalytics({
  orgId,
  categoryFilter,
}: {
  orgId: string;
  categoryFilter?: string;
}) {
  const { t } = useLocale();
  const supabase = createSupabaseBrowserClient();
  const { data, isLoading, error } = useOrgOverview(supabase, orgId);
  const { data: modules } = useModules(supabase, categoryFilter ? undefined : orgId);

  const scoped = useMemo(() => {
    if (!data) return null;
    if (!categoryFilter) return data;

    const counterparties = data.counterparties.filter((c) =>
      c.categories?.includes(categoryFilter),
    );
    const ids = new Set(counterparties.map((c) => c.id));
    const transactions = data.transactions.filter((t) => ids.has(t.counterpartyId));
    return { counterparties, transactions };
  }, [data, categoryFilter]);

  if (isLoading) {
    return (
      <div className="mb-6 h-40 animate-pulse rounded-xl border border-slate-200 bg-slate-50" />
    );
  }

  if (error) {
    return (
      <p className="mb-6 text-sm text-rose-600">
        {t('common.error')}: {(error as Error).message}
      </p>
    );
  }

  if (!scoped) return null;

  return (
    <div className="mb-6 flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <LedgerAnalytics transactions={scoped.transactions} />
        </div>
        <TopDebtors counterparties={scoped.counterparties} transactions={scoped.transactions} />
      </div>

      {!categoryFilter && modules && modules.length > 0 && (
        <ModuleBreakdownTable
          modules={modules}
          counterparties={scoped.counterparties}
          transactions={scoped.transactions}
        />
      )}
    </div>
  );
}
