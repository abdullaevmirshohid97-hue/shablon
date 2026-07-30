import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServerTranslator } from '@/lib/i18n/server';
import { ModulesSettings } from './modules-settings';
import { AccountingPeriods } from './accounting-periods';
import { AuditLog } from './audit-log';

export default async function SettingsPage() {
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

  if (!org) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{t('dashboard.welcomeTitle')}</h1>
        <p className="mt-2 text-sm text-slate-600">{t('dashboard.noOrgMessage')}</p>
      </div>
    );
  }

  // Everything here either writes (modules) or exposes other people's edit
  // history (the audit log). Managers are redirected instead of being shown a
  // page whose every control fails against RLS — the sidebar already hides the
  // link, this closes the direct-URL route too.
  if (org.role !== 'owner' && org.role !== 'admin') redirect('/dashboard');

  return (
    <div className="max-w-4xl">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-slate-900">
        {t('settings.title')}
      </h1>
      <div className="flex flex-col gap-6">
        <ModulesSettings orgId={org.org_id} />
        <AccountingPeriods orgId={org.org_id} />
        <AuditLog orgId={org.org_id} />
      </div>
    </div>
  );
}
