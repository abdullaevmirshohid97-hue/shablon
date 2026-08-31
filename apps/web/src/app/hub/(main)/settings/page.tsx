import { getOrgContext, safeNext } from '@/lib/auth/activeOrg';
import { getServerTranslator } from '@/lib/i18n/server';
import { OrgPicker } from '@/app/select-org/org-picker';
import { EmployeesSettings } from './employees-settings';

export default async function HubSettingsPage() {
  const { t } = await getServerTranslator();
  const { active, options } = await getOrgContext();
  const isOrgAdmin = active?.role === 'owner' || active?.role === 'admin';

  return (
    <div className="flex flex-col gap-8">
      {/* Which businesses this account has, and the way to another one. It
          belongs in settings rather than behind a module: an organization is
          not part of the warehouse or the ledger, it is the thing they are
          kept for. */}
      <section>
        <h2 className="mb-1 text-lg font-semibold text-slate-900">{t('org.selectTitle')}</h2>
        <p className="mb-4 text-sm text-slate-500">
          {options.length ? t('org.selectHint') : t('org.emptyHint')}
        </p>
        <OrgPicker
          options={options}
          activeOrgId={active?.orgId ?? null}
          next={safeNext('/hub/settings')}
        />
      </section>

      {isOrgAdmin && active && <EmployeesSettings orgId={active.orgId} />}
    </div>
  );
}
