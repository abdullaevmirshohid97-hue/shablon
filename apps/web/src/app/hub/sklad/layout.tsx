import { requireSkladAccess } from './access';
import { SkladNav } from './sklad-nav';

export default async function SkladLayout({ children }: { children: React.ReactNode }) {
  const { isOrgAdmin } = await requireSkladAccess();

  return (
    <div className="flex flex-col">
      <SkladNav isOrgAdmin={isOrgAdmin} />
      {children}
    </div>
  );
}
