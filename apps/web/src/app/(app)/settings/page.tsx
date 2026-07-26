import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServerTranslator } from '@/lib/i18n/server';
import { ModulesSettings } from './modules-settings';

export default async function SettingsPage() {
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

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-slate-900">
        {t('settings.title')}
      </h1>
      <div className="flex flex-col gap-6">
        <ModulesSettings orgId={org.org_id} />
      </div>
    </div>
  );
}
