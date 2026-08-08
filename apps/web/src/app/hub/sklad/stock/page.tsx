import { requireSkladAccess } from '../access';
import { StockList } from './stock-list';

export default async function SkladStockPage() {
  const { orgId, isOrgAdmin } = await requireSkladAccess();
  return <StockList orgId={orgId} isOrgAdmin={isOrgAdmin} />;
}
