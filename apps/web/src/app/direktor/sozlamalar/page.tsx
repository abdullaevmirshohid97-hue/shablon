import { getOrgContext } from '@/lib/auth/activeOrg';
import { DirectorPinSettings } from '../pin-settings';

export default async function Page() {
  const { options } = await getOrgContext();
  const managed = options.filter((o) => o.role === 'owner' || o.role === 'admin');

  return <DirectorPinSettings orgs={managed} />;
}
