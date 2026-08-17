import Link from 'next/link';
import { redirect } from 'next/navigation';
import { one } from '@mubosher/shared';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServerTranslator } from '@/lib/i18n/server';
import { OverviewAnalytics } from '@/components/OverviewAnalytics';

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { t } = await getServerTranslator();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: memberships } = await supabase
    .from('memberships')
    .select('org_id, role, organizations(name, slug)')
    .eq('user_id', user.id);

  const org = memberships?.[0];

  if (!org) {
    return (
      <div>
        <h1 className="text-fin-xl font-semibold text-slate-900">{t('dashboard.welcomeTitle')}</h1>
        <p className="mt-2 text-fin-md text-slate-600">{t('dashboard.noOrgMessage')}</p>
      </div>
    );
  }

  const { count: counterpartyCount } = await supabase
    .from('counterparties')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', org.org_id)
    .is('archived_at', null);

  // Brand-new org: no clients yet, so analytics would be an empty wall.
  // Point straight at the client directory where the first one is created.
  if (!counterpartyCount) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="max-w-md text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-fin-xl font-bold text-white">
            M
          </span>
          <h1 className="mt-4 text-fin-xl font-semibold text-slate-900">
            {t('dashboard.onboardingTitle')}
          </h1>
          <p className="mt-2 text-fin-md text-slate-600">{t('dashboard.onboardingMessage')}</p>
          <Link
            href="/clients"
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-fin-md font-medium text-white transition-colors hover:bg-brand-700"
          >
            {t('dashboard.onboardingCta')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-fin-2xl font-semibold tracking-tight text-slate-900">
        {t('nav.clients')}
      </h1>

      <OverviewAnalytics orgId={org.org_id} orgName={one(org.organizations)?.name ?? null} />
    </div>
  );
}
