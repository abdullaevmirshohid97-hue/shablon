import { getOrgContext } from '@/lib/auth/activeOrg';
import { DirectorClients } from '../all-clients';

export default async function Page() {
  const { options } = await getOrgContext();
  const managed = options.filter((o) => o.role === 'owner' || o.role === 'admin');

  return <DirectorClients orgs={managed} />;
}
