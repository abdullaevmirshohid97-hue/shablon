import { HubSidebar } from './hub-sidebar';

export function HubShell({
  children,
  orgName,
  userEmail,
  isOrgAdmin,
}: {
  children: React.ReactNode;
  orgName: string | null;
  userEmail: string;
  isOrgAdmin: boolean;
}) {
  return (
    <div className="flex w-full">
      <HubSidebar orgName={orgName} userEmail={userEmail} isOrgAdmin={isOrgAdmin} />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</main>
    </div>
  );
}
