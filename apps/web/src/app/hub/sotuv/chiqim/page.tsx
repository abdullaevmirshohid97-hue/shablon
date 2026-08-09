import { requireModuleAccess } from '../../access';
import { ChiqimGrid } from './chiqim-grid';

export default async function SkladChiqimPage() {
  const { orgId } = await requireModuleAccess();
  return <ChiqimGrid orgId={orgId} />;
}
