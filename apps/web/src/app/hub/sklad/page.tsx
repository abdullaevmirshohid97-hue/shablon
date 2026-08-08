import { requireSkladAccess } from './access';
import { OverviewView } from './overview-view';

/** The warehouse landing page is the overview, the way an ERP module's is:
 * where every order stands before anyone drills into one. */
export default async function SkladPage() {
  const { orgId, isOrgAdmin } = await requireSkladAccess();
  return <OverviewView orgId={orgId} isOrgAdmin={isOrgAdmin} />;
}
