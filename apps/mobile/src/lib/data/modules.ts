import { supabase } from '../supabase';
import { getLocalDb } from '../db/localDb';

export interface MobileModule {
  id: string;
  name: string;
}

/**
 * Loads the org's business modules (sidebar entries). RLS scopes the result
 * to the signed-in user's organization. Falls back to distinct categories
 * cached on counterparties when offline or when no modules exist yet.
 */
export async function loadModules(): Promise<MobileModule[]> {
  const { data, error } = await supabase.from('modules').select('id, name').order('name');
  if (!error && data) return data;

  // Offline / no modules: derive from cached counterparty categories.
  const db = await getLocalDb();
  const rows = await db.getAllAsync<{ categories: string }>(
    'SELECT categories FROM cached_counterparties',
  );
  const names = new Set<string>();
  for (const r of rows) {
    try {
      for (const c of JSON.parse(r.categories) as string[]) names.add(c);
    } catch {
      // ignore malformed cache rows
    }
  }
  return Array.from(names)
    .sort()
    .map((name) => ({ id: name, name }));
}
