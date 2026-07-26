import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { HubShell } from './hub-shell';

export default async function HubLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: memberships } = await supabase
    .from('memberships')
    .select('role, organizations(name)')
    .eq('user_id', user.id);

  const orgName = memberships?.[0]?.organizations?.[0]?.name ?? null;
  const role = memberships?.[0]?.role ?? null;
  const isOrgAdmin = role === 'owner' || role === 'admin';

  return (
    <HubShell orgName={orgName} userEmail={user.email ?? ''} isOrgAdmin={isOrgAdmin}>
      {children}
    </HubShell>
  );
}
