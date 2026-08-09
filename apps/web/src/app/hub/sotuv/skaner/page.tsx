import { requireModuleAccess } from '../../access';
import { ScanDesk } from './scan-desk';

export default async function ScanPage() {
  const { orgId } = await requireModuleAccess();
  return <ScanDesk orgId={orgId} />;
}
