import { redirect } from 'next/navigation';
import { one } from '@mubosher/shared';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { HubShell } from '../hub-shell';

/**
 * The hub's own pages — the module picker and the organisation settings. They
 * are not behind a module lock: choosing where to go is not privileged, and
 * each door asks for itself.
 */
export default async function HubMainLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Not requireModuleAccess(): that redirects a member-less user to /hub, which
  // is this page — the module picker has to survive having no membership yet
  // and simply show no organisation in the footer.
  const { data: memberships } = await supabase
    .from('memberships')
    .select('role, organizations(name)')
    .eq('user_id', user.id);

  const orgName = one(memberships?.[0]?.organizations)?.name ?? null;
  const role = memberships?.[0]?.role ?? null;
  const isOrgAdmin = role === 'owner' || role === 'admin';

  return (
    <HubShell orgName={orgName} userEmail={user.email ?? ''} isOrgAdmin={isOrgAdmin}>
      {children}
    </HubShell>
  );
}
