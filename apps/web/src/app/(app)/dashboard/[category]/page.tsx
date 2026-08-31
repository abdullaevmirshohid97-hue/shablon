import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getOrgContext } from '@/lib/auth/activeOrg';
import { getServerTranslator } from '@/lib/i18n/server';
import { getOverdueDebts } from '@/lib/counterpartyDebt';
import { AddCounterpartyForm } from '../add-counterparty-form';
import { CounterpartyList } from '../counterparty-list';
import { OverviewAnalytics } from '@/components/OverviewAnalytics';

export default async function CategoryModulePage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category: encodedCategory } = await params;
  const category = decodeURIComponent(encodedCategory);

  const supabase = await createSupabaseServerClient();
  const { t } = await getServerTranslator();
  const { active: org } = await getOrgContext();
  const canWrite = org?.role === 'owner' || org?.role === 'admin';

  if (!org) {
    return (
      <div>
        <h1 className="text-fin-xl font-semibold text-slate-900">{t('dashboard.welcomeTitle')}</h1>
        <p className="mt-2 text-fin-md text-slate-600">{t('dashboard.noOrgMessage')}</p>
      </div>
    );
  }

  const [{ data: counterparties }, debtByCounterparty] = await Promise.all([
    supabase
      .from('counterparties')
      .select('id, name, phone, categories')
      .eq('org_id', org.orgId)
      .contains('categories', [category])
      .is('archived_at', null)
      .order('name'),
    // Scoped to the module, like the list beside it: a badge counting debts
    // from clients this page does not show is a figure with no home.
    getOverdueDebts(supabase, org.orgId, category),
  ]);

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-fin-2xl font-semibold tracking-tight text-slate-900">{category}</h1>
          <p className="mt-1 text-fin-md text-slate-500 tabular-nums">
            {counterparties?.length ?? 0}
          </p>
        </div>
      </div>

      <OverviewAnalytics
        orgId={org.orgId}
        orgName={org.name}
        baseCurrency={org.baseCurrency}
        categoryFilter={category}
      />

      {/* Adding a client is a write — managers get the directory read-only.
          RLS enforces it; this just doesn't offer a form that would fail. */}
      {canWrite && (
        <div className="mb-6 max-w-2xl">
          <AddCounterpartyForm orgId={org.orgId} presetCategory={category} />
        </div>
      )}

      <CounterpartyList
        counterparties={counterparties ?? []}
        debtByCounterparty={debtByCounterparty}
      />
    </div>
  );
}
