import { getOrgContext } from '@/lib/auth/activeOrg';
import { HubShell } from '../hub-shell';

/**
 * The hub's own pages — the module picker and the organisation settings. They
 * are not behind a module lock: choosing where to go is not privileged, and
 * each door asks for itself.
 */
export default async function HubMainLayout({ children }: { children: React.ReactNode }) {
  // Deliberately not requireOrgChoice(): the module picker has to survive
  // having no membership yet, and choosing a business before choosing a door
  // is a question with no answer here. Each module asks for itself.
  const { active, userEmail } = await getOrgContext();

  const isOrgAdmin = active?.role === 'owner' || active?.role === 'admin';

  // Switching, and creating, both live in hub settings — an organization is
  // not part of any one module, so the sidebar does not grow a control for it.
  return (
    <HubShell orgName={active?.name ?? null} userEmail={userEmail} isOrgAdmin={isOrgAdmin}>
      {children}
    </HubShell>
  );
}
