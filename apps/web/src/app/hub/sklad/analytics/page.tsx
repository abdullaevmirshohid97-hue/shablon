import { requireSkladAccess } from '../access';
import { SkladAnalytics } from './analytics-view';

export default async function SkladAnalyticsPage() {
  const { orgId, isOrgAdmin } = await requireSkladAccess();
  return <SkladAnalytics orgId={orgId} isOrgAdmin={isOrgAdmin} />;
}
