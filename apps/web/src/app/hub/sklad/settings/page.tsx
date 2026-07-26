import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { LookupSettings } from '../lookup-settings';

export default async function SkladSettingsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: memberships } = await supabase
    .from('memberships')
    .select('org_id, role')
    .eq('user_id', user.id);

  const membership = memberships?.[0];
  const isOrgAdmin = membership?.role === 'owner' || membership?.role === 'admin';

  if (!membership || !isOrgAdmin) redirect('/hub/sklad');

  return <LookupSettings orgId={membership.org_id} />;
}
