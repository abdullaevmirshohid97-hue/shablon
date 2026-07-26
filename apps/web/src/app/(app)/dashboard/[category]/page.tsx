import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: memberships } = await supabase
    .from('memberships')
    .select('org_id')
    .eq('user_id', user.id);

  const org = memberships?.[0];

  if (!org) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{t('dashboard.welcomeTitle')}</h1>
        <p className="mt-2 text-sm text-slate-600">{t('dashboard.noOrgMessage')}</p>
      </div>
    );
  }

  const [{ data: counterparties }, debtByCounterparty] = await Promise.all([
    supabase
      .from('counterparties')
      .select('id, name, phone, categories')
      .eq('org_id', org.org_id)
      .contains('categories', [category])
      .order('name'),
    getOverdueDebts(supabase, org.org_id),
  ]);

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{category}</h1>
          <p className="mt-1 text-sm text-slate-500 tabular-nums">{counterparties?.length ?? 0}</p>
        </div>
      </div>

      <OverviewAnalytics orgId={org.org_id} categoryFilter={category} />

      <div className="mb-6 max-w-2xl">
        <AddCounterpartyForm orgId={org.org_id} presetCategory={category} />
      </div>

      <CounterpartyList
        counterparties={counterparties ?? []}
        debtByCounterparty={debtByCounterparty}
      />
    </div>
  );
}
