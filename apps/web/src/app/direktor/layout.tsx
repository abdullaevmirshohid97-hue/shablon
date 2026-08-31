import { redirect } from 'next/navigation';
import { getOrgContext } from '@/lib/auth/activeOrg';
import { DirectorShell } from './director-shell';

/**
 * The one screen that is not inside an organization.
 *
 * Every other page in the app resolves an active org first and reads through
 * it. This one reads across every organization the account owns or
 * administers, which is why it sits at the root rather than under /hub — the
 * hub's own access helper pins exactly one, and pinning one here would defeat
 * the screen.
 *
 * "Every organization" means every one this account is a member of. It is not
 * a platform-wide view: that already exists at /admin, behind the
 * platform_admin role, and reaching other tenants' books from here would make
 * a four-digit code the only thing between one customer and another's ledger.
 */
export default async function DirectorLayout({ children }: { children: React.ReactNode }) {
  const { options } = await getOrgContext();

  // Watching is an owner's job. A staff member has no business here even in
  // their own organization, and RLS would refuse most of it anyway.
  const managed = options.filter((o) => o.role === 'owner' || o.role === 'admin');
  if (!managed.length) redirect('/hub');

  return <DirectorShell orgs={managed}>{children}</DirectorShell>;
}
