import { requireModuleAccess } from '../../access';
import { OrdersList } from './orders-list';

export default async function SkladOrdersPage() {
  const { orgId, isOrgAdmin } = await requireModuleAccess();
  return <OrdersList orgId={orgId} isOrgAdmin={isOrgAdmin} />;
}
