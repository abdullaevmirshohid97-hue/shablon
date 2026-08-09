import { requireModuleAccess } from '../../../access';
import { PackageView } from './package-view';

/**
 * What the QR on a sack resolves to. The segment is whatever was in the code —
 * the uuid from the QR, the printed QOP number, or the sack's barcode — and
 * the lookup accepts all three.
 */
export default async function PackagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { orgId } = await requireModuleAccess();
  return <PackageView orgId={orgId} code={decodeURIComponent(id)} />;
}
