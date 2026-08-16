import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServerTranslator } from '@/lib/i18n/server';
import { getOverdueDebts } from '@/lib/counterpartyDebt';
import { AddCounterpartyForm } from '../dashboard/add-counterparty-form';
import { CounterpartyList } from '../dashboard/counterparty-list';

/**
 * The full client directory: every counterparty of the org, including ones
 * without any module tag. This page (not the module pages) is the canonical
 * place to add a client, so a brand-new org with zero modules can still
 * create its first counterparty.
 */
export default async function ClientsPage() {
  const supabase = await createSupabaseServerClient();
  const { t } = await getServerTranslator();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: memberships } = await supabase
    .from('memberships')
    .select('org_id, role')
    .eq('user_id', user.id);

  const org = memberships?.[0];
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
      .eq('org_id', org.org_id)
      .order('name'),
    getOverdueDebts(supabase, org.org_id),
  ]);

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-fin-2xl font-semibold tracking-tight text-slate-900">
            {t('dashboard.title')}
          </h1>
          <p className="mt-1 text-fin-md text-slate-500 tabular-nums">
            {counterparties?.length ?? 0}
          </p>
        </div>
      </div>

      {/* Managers read the directory; only owner/admin may add a client. The
          form stays behind its button: this page is a list to be read, not a
          form to be filled. */}
      {canWrite && (
        <div className="mb-6 max-w-2xl">
          <AddCounterpartyForm orgId={org.org_id} collapsible />
        </div>
      )}

      <CounterpartyList
        counterparties={counterparties ?? []}
        debtByCounterparty={debtByCounterparty}
      />
    </div>
  );
}
