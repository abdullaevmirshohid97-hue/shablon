import { requireSkladAdmin } from '../../access';
import { SkladSettingsView } from './settings-view';

export default async function SkladSettingsPage() {
  const { orgId } = await requireSkladAdmin();
  return <SkladSettingsView orgId={orgId} />;
}
