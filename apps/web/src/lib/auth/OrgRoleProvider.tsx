'use client';

import { createContext, useContext, useMemo } from 'react';
import type { OrgRole } from '@mubosher/shared';

interface OrgRoleContextValue {
  role: OrgRole | null;
  /**
   * owner/admin — may enter and edit Finance data. Mirrors the
   * `can_write_finance()` SQL helper (0012_finance_write_lock.sql); RLS is
   * what actually enforces this, and this flag only decides whether the UI
   * offers a control the server would reject anyway.
   */
  canWrite: boolean;
}

const OrgRoleContext = createContext<OrgRoleContextValue | null>(null);

/**
 * Carries the signed-in user's role for the current org down through the
 * Finance section. The role is resolved once, server-side, in the (app)
 * layout — deep client components (the ledger's inline entry row, the
 * add-client form, the sidebar) read it from here instead of each re-querying
 * memberships or having it threaded through five levels of props.
 */
export function OrgRoleProvider({
  role,
  children,
}: {
  role: OrgRole | null;
  children: React.ReactNode;
}) {
  const value = useMemo(() => ({ role, canWrite: role === 'owner' || role === 'admin' }), [role]);

  return <OrgRoleContext.Provider value={value}>{children}</OrgRoleContext.Provider>;
}

export function useOrgRole() {
  const ctx = useContext(OrgRoleContext);
  if (!ctx) throw new Error('useOrgRole must be used within OrgRoleProvider');
  return ctx;
}

/** Renders `children` only for owner/admin. For server-rendered subtrees that sit inside the provider. */
export function AdminOnly({ children }: { children: React.ReactNode }) {
  const { canWrite } = useOrgRole();
  return canWrite ? <>{children}</> : null;
}
