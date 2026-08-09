import { requireModuleAccess } from '../../../access';
import { FakturaDocument } from './faktura-document';

export default async function SkladFakturaDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { orgId } = await requireModuleAccess();
  return <FakturaDocument orgId={orgId} invoiceId={id} />;
}
