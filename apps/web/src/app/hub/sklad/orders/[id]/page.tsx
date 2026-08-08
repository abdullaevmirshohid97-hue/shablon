import { requireSkladAccess } from '../../access';
import { OrderDetail } from './order-detail';

export default async function SkladOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { orgId, isOrgAdmin } = await requireSkladAccess();
  return <OrderDetail orgId={orgId} orderId={id} isOrgAdmin={isOrgAdmin} />;
}
