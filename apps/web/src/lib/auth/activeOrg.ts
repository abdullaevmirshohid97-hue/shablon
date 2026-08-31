import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { one, type OrgRole } from '@mubosher/shared';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Which organization the app is currently looking at.
 *
 * Every page used to answer this with `memberships?.[0]` — nine of them, and
 * `hub/access.ts` said so out loud: "a user belongs to one org here, and the
 * day that changes it changes everywhere at once." This is that day. The
 * database never made the assumption: every RPC takes `target_org_id` and
 * checks `is_org_member`, and RLS is per-org throughout. Only the app was
 * picking the first row and calling it the answer.
 *
 * The choice lives in a cookie rather than localStorage because the pages that
 * need it are server components, and localStorage is not something a server
 * can read. It is never trusted: the cookie names an org, and the membership
 * query decides whether that name means anything.
 */

export const ACTIVE_ORG_COOKIE = 'mubosher.orgId';

export interface OrgOption {
  orgId: string;
  name: string;
  slug: string | null;
  baseCurrency: string;
  role: OrgRole;
}

export interface OrgContext {
  userId: string;
  userEmail: string;
  /** Every org this user belongs to, by name. */
  options: OrgOption[];
  /** The one in force, or null when they belong to none. */
  active: OrgOption | null;
  /** True when the cookie named an org and that org checked out. */
  chosen: boolean;
}

export async function getOrgContext(): Promise<OrgContext> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: memberships } = await supabase
    .from('memberships')
    .select('org_id, role, organizations(name, slug, base_currency)')
    .eq('user_id', user.id);

  const options: OrgOption[] = (memberships ?? [])
    .map((m) => {
      const org = one(m.organizations) as {
        name: string;
        slug: string | null;
        base_currency: string;
      } | null;
      return {
        orgId: m.org_id,
        name: org?.name ?? '—',
        slug: org?.slug ?? null,
        baseCurrency: org?.base_currency ?? 'UZS',
        role: m.role as OrgRole,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const requested = (await cookies()).get(ACTIVE_ORG_COOKIE)?.value;
  const fromCookie = requested ? (options.find((o) => o.orgId === requested) ?? null) : null;

  return {
    userId: user.id,
    userEmail: user.email ?? '',
    options,
    // Falling back to the first one keeps every single-org account working
    // exactly as it did, cookie or no cookie.
    active: fromCookie ?? options[0] ?? null,
    chosen: Boolean(fromCookie),
  };
}

/**
 * The same, but sends anyone with a choice to make off to make it.
 *
 * Only when there is a real choice: one org goes straight through, because an
 * account with a single organization should never meet a screen asking which.
 */
export async function requireOrgChoice(next: string): Promise<OrgContext> {
  const context = await getOrgContext();

  if (context.options.length > 1 && !context.chosen) {
    redirect(`/select-org?next=${encodeURIComponent(next)}`);
  }

  return context;
}

/**
 * A destination that is safe to send a browser to.
 *
 * `next` arrives in a query string, so it is a value from outside: without
 * this, `/select-org?next=https://elsewhere` turns the picker into an open
 * redirect for anyone who can get that link in front of a signed-in user.
 */
export function safeNext(next: string | undefined, fallback = '/hub'): string {
  if (!next) return fallback;
  if (!next.startsWith('/') || next.startsWith('//')) return fallback;
  return next;
}
