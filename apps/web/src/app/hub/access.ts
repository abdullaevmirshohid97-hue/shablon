import { redirect } from 'next/navigation';
import { getOrgContext } from '@/lib/auth/activeOrg';

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
 * redirect. It used to take `memberships?.[0]` and note that "a user belongs
 * to one org here, and the day that changes it changes everywhere at once".
 * That day came: it reads the organization in force now (see `activeOrg`), and
 * sends anyone with more than one and no choice made off to make it first.
 *
 * It lives at `/hub` rather than under `/hub/sklad` because the warehouse is
 * no longer the only module behind it — Sotuv bo'limi asks the same question.
 */
export async function requireModuleAccess(next = '/hub'): Promise<ModuleAccess> {
  const { active, options, chosen, userId, userEmail } = await getOrgContext();

  if (!active) redirect('/hub');
  if (options.length > 1 && !chosen) {
    redirect(`/select-org?next=${encodeURIComponent(next)}`);
  }

  return {
    orgId: active.orgId,
    isOrgAdmin: active.role === 'owner' || active.role === 'admin',
    userId,
    userEmail,
    orgName: active.name,
  };
}

/** Same, but for screens only an owner/admin may open at all. */
export async function requireSkladAdmin(): Promise<ModuleAccess> {
  const access = await requireModuleAccess('/hub/sklad');
  if (!access.isOrgAdmin) redirect('/hub/sklad');
  return access;
}
