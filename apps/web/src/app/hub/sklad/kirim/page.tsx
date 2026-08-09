import { requireModuleAccess } from '../../access';
import { KirimGrid } from './kirim-grid';

export default async function SkladKirimPage() {
  const { orgId } = await requireModuleAccess();
  return <KirimGrid orgId={orgId} />;
}
