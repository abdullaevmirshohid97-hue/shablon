import { requireSkladAccess } from './access';
import { SkladList } from './sklad-list';

export default async function SkladPage() {
  const { orgId, isOrgAdmin } = await requireSkladAccess();
  return <SkladList orgId={orgId} isOrgAdmin={isOrgAdmin} />;
}
