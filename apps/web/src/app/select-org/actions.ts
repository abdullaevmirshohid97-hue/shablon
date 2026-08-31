'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ACTIVE_ORG_COOKIE, safeNext } from '@/lib/auth/activeOrg';

/**
 * Puts an organization in force and sends the browser on.
 *
 * A server action rather than a click handler because a cookie is the only
 * place a server component can be told which org to render, and only a server
 * action or a route handler may set one.
 *
 * The membership check is the point of the whole function. The cookie decides
 * what every page below it queries, so a value that arrived from the browser
 * is checked against the user's actual memberships before it is written —
 * RLS would refuse the data anyway, but a page rendering an empty org because
 * someone edited a cookie is a bug report, not a defence.
 */
export async function chooseOrg(orgId: string, next?: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: membership } = await supabase
    .from('memberships')
    .select('org_id')
    .eq('user_id', user.id)
    .eq('org_id', orgId)
    .maybeSingle();

  if (!membership) redirect('/select-org');

  (await cookies()).set(ACTIVE_ORG_COOKIE, orgId, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365,
  });

  redirect(safeNext(next));
}
