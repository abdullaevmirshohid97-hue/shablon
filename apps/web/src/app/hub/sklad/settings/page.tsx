import { requireSkladAdmin } from '../access';
import { LookupSettings } from '../lookup-settings';
import { SkladAuditLog } from '../sklad-audit-log';

export default async function SkladSettingsPage() {
  const { orgId } = await requireSkladAdmin();

  return (
    <div className="flex flex-col gap-6">
      <LookupSettings orgId={orgId} />
      <SkladAuditLog orgId={orgId} />
    </div>
  );
}
