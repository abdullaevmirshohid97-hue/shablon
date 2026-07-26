import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AppShell } from './app-shell';
import { FinancePinGate } from './finance-pin-gate';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: memberships } = await supabase
    .from('memberships')
    .select('org_id, organizations(name)')
    .eq('user_id', user.id);

  const orgId = memberships?.[0]?.org_id ?? null;
  const orgName = memberships?.[0]?.organizations?.[0]?.name ?? null;

  let moduleCategories: string[] = [];
  if (orgId) {
    const { data: modules } = await supabase
      .from('modules')
      .select('name')
      .eq('org_id', orgId)
      .order('name');
    moduleCategories = (modules ?? []).map((m) => m.name);
  }

  return (
    <FinancePinGate orgId={orgId}>
      <AppShell orgName={orgName} userEmail={user.email ?? ''} moduleCategories={moduleCategories}>
        {children}
      </AppShell>
    </FinancePinGate>
  );
}
