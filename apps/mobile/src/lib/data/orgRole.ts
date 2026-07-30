import type { OrgRole } from '@mubosher/shared';
import { supabase } from '../supabase';
import { getLocalDb } from '../db/localDb';

const ROLE_KEY = 'org_role';

export interface OrgRoleInfo {
  role: OrgRole | null;
  /** owner/admin — may enter data. Mirrors `can_write_finance()` on the server. */
  canWrite: boolean;
  fromCache: boolean;
}

function toInfo(role: OrgRole | null, fromCache: boolean): OrgRoleInfo {
  return { role, canWrite: role === 'owner' || role === 'admin', fromCache };
}

/**
 * The signed-in user's role in their org, cached locally so the entry screen
 * still knows whether to open when the phone is offline.
 *
 * Erring toward read-only is deliberate: on a cold, offline start with no
 * cached role, `canWrite` is false. A manager who wrongly got the entry form
 * would fill a queue the server then rejects row by row; an admin who has to
 * come back online once loses nothing.
 */
export async function loadOrgRole(): Promise<OrgRoleInfo> {
  const db = await getLocalDb();

  const { data, error } = await supabase.from('memberships').select('role').limit(1);

  if (!error && data?.[0]) {
    const role = data[0].role as OrgRole;
    await db.runAsync('INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)', [
      ROLE_KEY,
      role,
    ]);
    return toInfo(role, false);
  }

  const cached = await db.getFirstAsync<{ value: string | null }>(
    'SELECT value FROM app_state WHERE key = ?',
    [ROLE_KEY],
  );

  return toInfo((cached?.value as OrgRole | undefined) ?? null, true);
}

/** Called on sign-out so the next user on this device doesn't inherit the previous role. */
export async function clearCachedOrgRole(): Promise<void> {
  const db = await getLocalDb();
  await db.runAsync('DELETE FROM app_state WHERE key = ?', [ROLE_KEY]);
}
