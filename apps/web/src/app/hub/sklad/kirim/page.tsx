import { requireSkladAccess } from '../access';
import { KirimGrid } from './kirim-grid';

export default async function SkladKirimPage() {
  const { orgId } = await requireSkladAccess();
  return <KirimGrid orgId={orgId} />;
}
