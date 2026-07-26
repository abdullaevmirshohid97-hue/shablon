'use client';

import { Sidebar } from './sidebar';

export function AppShell({
  children,
  orgName,
  userEmail,
  moduleCategories,
}: {
  children: React.ReactNode;
  orgName: string | null;
  userEmail: string;
  moduleCategories: string[];
}) {
  return (
    <div className="flex w-full">
      <Sidebar orgName={orgName} userEmail={userEmail} moduleCategories={moduleCategories} />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</main>
    </div>
  );
}
