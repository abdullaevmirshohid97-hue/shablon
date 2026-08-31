import { redirect } from 'next/navigation';
import { getOrgContext } from '@/lib/auth/activeOrg';
import { getServerTranslator } from '@/lib/i18n/server';
import { OrganizationSettings } from './organization-settings';
import { CounterpartiesSettings } from './counterparties-settings';
import { ModulesSettings } from './modules-settings';
import { AccountingPeriods } from './accounting-periods';
import { ExchangeRates } from './exchange-rates';
import { AuditLog } from './audit-log';

export default async function SettingsPage() {
  const { t } = await getServerTranslator();
  const { active: org } = await getOrgContext();

  if (!org) {
    return (
      <div>
        <h1 className="text-fin-xl font-semibold text-slate-900">{t('dashboard.welcomeTitle')}</h1>
        <p className="mt-2 text-fin-md text-slate-600">{t('dashboard.noOrgMessage')}</p>
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
      <h1 className="mb-6 text-fin-2xl font-semibold tracking-tight text-slate-900">
        {t('settings.title')}
      </h1>
      <div className="flex flex-col gap-6">
        <OrganizationSettings orgId={org.orgId} initialName={org.name} />
        <CounterpartiesSettings orgId={org.orgId} />
        <ModulesSettings orgId={org.orgId} />
        <AccountingPeriods orgId={org.orgId} />
        <ExchangeRates orgId={org.orgId} baseCurrency={org.baseCurrency} />
        <AuditLog orgId={org.orgId} />
      </div>
    </div>
  );
}
