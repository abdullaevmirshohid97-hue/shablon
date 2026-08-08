import { requireSkladAccess } from '../../access';
import { FakturaDocument } from './faktura-document';

export default async function SkladFakturaDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { orgId } = await requireSkladAccess();
  return <FakturaDocument orgId={orgId} invoiceId={id} />;
}
