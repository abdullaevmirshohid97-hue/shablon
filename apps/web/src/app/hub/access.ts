import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export interface ModuleAccess {
  orgId: string;
  isOrgAdmin: boolean;
  userId: string;
  userEmail: string;
  orgName: string | null;
}

/**
 * The membership check every hub screen starts with, in one place.
 *
 * It was copied verbatim into each page, which is fine at two pages and a
 * liability at five — the version that drifts is the one that forgets to
 * redirect. `memberships?.[0]` matches the rest of the app: a user belongs to
 * one org here, and the day that changes it changes everywhere at once.
 *
 * It lives at `/hub` rather than under `/hub/sklad` because the warehouse is
 * no longer the only module behind it — Sotuv bo'limi asks the same question.
 */
export async function requireModuleAccess(): Promise<ModuleAccess> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: memberships } = await supabase
    .from('memberships')
    .select('org_id, role, organizations(name)')
    .eq('user_id', user.id);

  const membership = memberships?.[0];
  if (!membership) redirect('/hub');

  const organizations = membership.organizations as { name: string } | { name: string }[] | null;
  const orgName = Array.isArray(organizations)
    ? (organizations[0]?.name ?? null)
    : (organizations?.name ?? null);

  return {
    orgId: membership.org_id,
    isOrgAdmin: membership.role === 'owner' || membership.role === 'admin',
    userId: user.id,
    userEmail: user.email ?? '',
    orgName,
  };
}

/** Same, but for screens only an owner/admin may open at all. */
export async function requireSkladAdmin(): Promise<ModuleAccess> {
  const access = await requireModuleAccess();
  if (!access.isOrgAdmin) redirect('/hub/sklad');
  return access;
}
