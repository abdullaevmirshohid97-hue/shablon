import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireOrgChoice } from '@/lib/auth/activeOrg';
import { OrgRoleProvider } from '@/lib/auth/OrgRoleProvider';
import { AppShell } from './app-shell';
import { ModuleAccessGate } from '@/components/ModuleAccessGate';
import { getServerTranslator } from '@/lib/i18n/server';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const { t } = await getServerTranslator();

  // Which business, before which person: the roster and the PIN the gate below
  // asks for are per-organization, so a user with more than one is sent to
  // choose before any of that is fetched. One organization goes straight
  // through — there is nothing to choose.
  const { active, options, userId, userEmail } = await requireOrgChoice('/dashboard');

  const orgId = active?.orgId ?? null;
  const orgName = active?.name ?? null;
  const role = active?.role ?? null;

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
      <ModuleAccessGate orgId={orgId} currentUserId={userId} moduleName={t('hub.finance')}>
        <AppShell
          orgName={orgName}
          userEmail={userEmail}
          canSwitchOrg={options.length > 1}
          moduleCategories={moduleCategories}
        >
          {children}
        </AppShell>
      </ModuleAccessGate>
    </OrgRoleProvider>
  );
}
