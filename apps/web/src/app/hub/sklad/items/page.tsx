import { requireSkladAccess } from '../access';
import { ItemsList } from './items-list';

export default async function SkladItemsPage() {
  const { orgId, isOrgAdmin } = await requireSkladAccess();
  return <ItemsList orgId={orgId} isOrgAdmin={isOrgAdmin} />;
}
