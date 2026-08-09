import { requireModuleAccess } from '../../access';
import { StockList } from './stock-list';

export default async function SkladStockPage() {
  const { orgId, isOrgAdmin } = await requireModuleAccess();
  return <StockList orgId={orgId} isOrgAdmin={isOrgAdmin} />;
}
