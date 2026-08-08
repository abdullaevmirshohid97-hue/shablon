import { requireSkladAccess } from '../access';
import { OrdersList } from './orders-list';

export default async function SkladOrdersPage() {
  const { orgId, isOrgAdmin } = await requireSkladAccess();
  return <OrdersList orgId={orgId} isOrgAdmin={isOrgAdmin} />;
}
