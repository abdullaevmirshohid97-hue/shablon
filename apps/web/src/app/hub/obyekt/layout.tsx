import { requireModuleAccess } from '../access';
import { ModuleShell } from '../module-sidebar';
import { ObyektSidebar } from './obyekt-sidebar';

/**
 * The explorer gets a rail but no lock.
 *
 * The modules are gated because typing into a ledger or moving stock on a
 * shared screen has to be attributable to a person. Reading is not: every query
 * underneath runs as whoever is signed in, and row-level security has already
 * decided what they may see — a price row a storekeeper cannot read comes back
 * missing whether or not a PIN was typed first. A second lock in front of that
 * would add friction without adding a rule.
 */
export default async function ObyektLayout({ children }: { children: React.ReactNode }) {
  const { userEmail, orgName } = await requireModuleAccess();

  return (
    <ModuleShell sidebar={<ObyektSidebar orgName={orgName} userEmail={userEmail} />}>
      {children}
    </ModuleShell>
  );
}
