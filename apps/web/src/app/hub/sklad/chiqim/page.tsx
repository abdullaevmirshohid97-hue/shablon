import { requireSkladAccess } from '../access';
import { ChiqimGrid } from './chiqim-grid';

export default async function SkladChiqimPage() {
  const { orgId } = await requireSkladAccess();
  return <ChiqimGrid orgId={orgId} />;
}
