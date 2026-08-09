import { requireModuleAccess } from '../access';
import { SalesClients } from './sales-clients';

/** Sotuv bo'limi opens on the clients, and the papers are one level down. */
export default async function SotuvPage() {
  const { orgId } = await requireModuleAccess();
  return <SalesClients orgId={orgId} />;
}
