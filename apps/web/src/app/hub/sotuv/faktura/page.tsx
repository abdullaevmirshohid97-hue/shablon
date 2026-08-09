import { requireModuleAccess } from '../../access';
import { FakturaList } from './faktura-list';

export default async function SkladFakturaPage() {
  const { orgId, isOrgAdmin } = await requireModuleAccess();
  return <FakturaList orgId={orgId} isOrgAdmin={isOrgAdmin} />;
}
