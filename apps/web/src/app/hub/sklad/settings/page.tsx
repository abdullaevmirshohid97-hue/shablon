import { requireSkladAdmin } from '../access';
import { LookupSettings } from '../lookup-settings';
import { StageSettings } from '../stage-settings';
import { SkladAuditLog } from '../sklad-audit-log';

export default async function SkladSettingsPage() {
  const { orgId } = await requireSkladAdmin();

  return (
    <div className="flex flex-col gap-6">
      <StageSettings orgId={orgId} />
      <LookupSettings orgId={orgId} />
      <SkladAuditLog orgId={orgId} />
    </div>
  );
}
