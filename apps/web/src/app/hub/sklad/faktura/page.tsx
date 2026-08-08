import { requireSkladAccess } from '../access';
import { FakturaList } from './faktura-list';

export default async function SkladFakturaPage() {
  const { orgId, isOrgAdmin } = await requireSkladAccess();
  return <FakturaList orgId={orgId} isOrgAdmin={isOrgAdmin} />;
}
