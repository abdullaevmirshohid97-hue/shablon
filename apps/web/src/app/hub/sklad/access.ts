import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export interface SkladAccess {
  orgId: string;
  isOrgAdmin: boolean;
  userId: string;
}

/**
 * The membership check every sklad screen starts with, in one place.
 *
 * It was copied verbatim into each page, which is fine at two pages and a
 * liability at five — the version that drifts is the one that forgets to
 * redirect. `memberships?.[0]` matches the rest of the app: a user belongs to
 * one org here, and the day that changes it changes everywhere at once.
 */
export async function requireSkladAccess(): Promise<SkladAccess> {
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
  if (!membership) redirect('/hub');

  return {
    orgId: membership.org_id,
    isOrgAdmin: membership.role === 'owner' || membership.role === 'admin',
    userId: user.id,
  };
}

/** Same, but for screens only an owner/admin may open at all. */
export async function requireSkladAdmin(): Promise<SkladAccess> {
  const access = await requireSkladAccess();
  if (!access.isOrgAdmin) redirect('/hub/sklad');
  return access;
}
