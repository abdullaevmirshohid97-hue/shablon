import { getOrgContext } from '@/lib/auth/activeOrg';
import { DirectorManagers } from '../all-managers';

export default async function Page() {
  const { options } = await getOrgContext();
  const managed = options.filter((o) => o.role === 'owner' || o.role === 'admin');

  return <DirectorManagers orgs={managed} />;
}
