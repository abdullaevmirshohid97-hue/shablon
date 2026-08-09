import { ModuleAccessGate } from '@/components/ModuleAccessGate';
import { getServerTranslator } from '@/lib/i18n/server';
import { requireModuleAccess } from '../access';
import { ModuleShell } from '../module-sidebar';
import { SkladSidebar } from './sklad-sidebar';

/**
 * Sklad behind its own lock and its own rail — the same shape Finance has.
 * The employee confirms who they are with the PIN the admin issued them, and
 * from then on the navigation is the warehouse's, not the hub's.
 */
export default async function SkladLayout({ children }: { children: React.ReactNode }) {
  const { orgId, userId, userEmail, orgName, isOrgAdmin } = await requireModuleAccess();
  const { t } = await getServerTranslator();

  return (
    <ModuleAccessGate orgId={orgId} currentUserId={userId} moduleName={t('hub.sklad')}>
      <ModuleShell
        sidebar={<SkladSidebar orgName={orgName} userEmail={userEmail} isOrgAdmin={isOrgAdmin} />}
      >
        {children}
      </ModuleShell>
    </ModuleAccessGate>
  );
}
