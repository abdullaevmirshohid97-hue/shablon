import { getOrgContext } from '@/lib/auth/activeOrg';
import { DirectorOverview } from './overview';

export default async function Page() {
  const { options } = await getOrgContext();
  const managed = options.filter((o) => o.role === 'owner' || o.role === 'admin');

  return <DirectorOverview orgs={managed} />;
}
