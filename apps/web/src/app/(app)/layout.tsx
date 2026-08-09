import { redirect } from 'next/navigation';
import { one, type OrgRole } from '@mubosher/shared';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { OrgRoleProvider } from '@/lib/auth/OrgRoleProvider';
import { AppShell } from './app-shell';
import { ModuleAccessGate } from '@/components/ModuleAccessGate';
import { getServerTranslator } from '@/lib/i18n/server';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const { t } = await getServerTranslator();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: memberships } = await supabase
    .from('memberships')
    .select('org_id, role, organizations(name)')
    .eq('user_id', user.id);

  const orgId = memberships?.[0]?.org_id ?? null;
  const orgName = one(memberships?.[0]?.organizations)?.name ?? null;
  const role = (memberships?.[0]?.role as OrgRole | undefined) ?? null;

  let moduleCategories: string[] = [];
  if (orgId) {
    const { data: modules } = await supabase
      .from('modules')
      .select('name')
      .eq('org_id', orgId)
      .order('name');
    moduleCategories = (modules ?? []).map((m) => m.name);
  }

  // The provider sits outside the gate so that after the gate's own
  // signInWithPassword + router.refresh() the whole subtree re-renders with
  // the role of whoever actually signed in, not whoever opened the browser.
  return (
    <OrgRoleProvider role={role}>
      <ModuleAccessGate orgId={orgId} currentUserId={user.id} moduleName={t('hub.finance')}>
        <AppShell
          orgName={orgName}
          userEmail={user.email ?? ''}
          moduleCategories={moduleCategories}
        >
          {children}
        </AppShell>
      </ModuleAccessGate>
    </OrgRoleProvider>
  );
}
