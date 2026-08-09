import { requireModuleAccess } from '../../../access';
import { OrderDetail } from './order-detail';

export default async function SkladOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { orgId, isOrgAdmin } = await requireModuleAccess();
  return <OrderDetail orgId={orgId} orderId={id} isOrgAdmin={isOrgAdmin} />;
}
