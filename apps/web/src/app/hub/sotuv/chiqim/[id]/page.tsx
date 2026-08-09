import { requireModuleAccess } from '../../../access';
import { ShipmentNote } from './shipment-note';

export default async function SkladShipmentNotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireModuleAccess();
  return <ShipmentNote shipmentId={id} />;
}
