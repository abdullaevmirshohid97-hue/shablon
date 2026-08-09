import { ModuleAccessGate } from '@/components/ModuleAccessGate';
import { getServerTranslator } from '@/lib/i18n/server';
import { requireModuleAccess } from '../access';
import { ModuleShell } from '../module-sidebar';
import { SotuvSidebar } from './sotuv-sidebar';

export default async function SotuvLayout({ children }: { children: React.ReactNode }) {
  const { orgId, userId, userEmail, orgName } = await requireModuleAccess();
  const { t } = await getServerTranslator();

  return (
    <ModuleAccessGate orgId={orgId} currentUserId={userId} moduleName={t('hub.sotuv')}>
      <ModuleShell sidebar={<SotuvSidebar orgName={orgName} userEmail={userEmail} />}>
        {children}
      </ModuleShell>
    </ModuleAccessGate>
  );
}
