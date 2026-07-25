import { supabase } from '../supabase';
import { getLocalDb } from '../db/localDb';

export type CategoryKind = 'kirim' | 'chiqim' | 'other';

export interface MobileCategory {
  id: string;
  org_id: string;
  name: string;
  unit: string | null;
  kind: CategoryKind;
}

/**
 * Loads the org's transaction categories classified as Kirim (debit side is
 * the receivable account — increases the client's debt) or Chiqim (credit
 * side is receivable — decreases it), mirroring useCategoriesWithKind on
 * web. Results are cached in SQLite so the entry form works offline.
 */
export async function loadCategoriesWithKind(orgId: string): Promise<MobileCategory[]> {
  const db = await getLocalDb();

  const [{ data: categories, error: catError }, { data: accounts, error: accError }] =
    await Promise.all([
      supabase.from('transaction_categories').select('*').eq('org_id', orgId),
      supabase.from('accounts').select('*').eq('org_id', orgId),
    ]);

  if (catError || accError || !categories || !accounts) {
    // Offline (or RLS failure): fall back to the local cache.
    return db.getAllAsync<MobileCategory>(
      'SELECT id, org_id, name, unit, kind FROM cached_categories WHERE org_id = ? ORDER BY name',
      [orgId],
    );
  }

  const accountsById = new Map(accounts.map((a) => [a.id, a]));

  const result: MobileCategory[] = categories.map((c) => {
    const debitType = c.default_debit_account_id
      ? accountsById.get(c.default_debit_account_id)?.type
      : undefined;
    const creditType = c.default_credit_account_id
      ? accountsById.get(c.default_credit_account_id)?.type
      : undefined;
    const kind: CategoryKind =
      debitType === 'receivable' ? 'kirim' : creditType === 'receivable' ? 'chiqim' : 'other';

    return { id: c.id, org_id: c.org_id, name: c.name, unit: c.unit, kind };
  });

  for (const c of result) {
    await db.runAsync(
      'INSERT OR REPLACE INTO cached_categories (id, org_id, name, unit, kind) VALUES (?, ?, ?, ?, ?)',
      [c.id, c.org_id, c.name, c.unit, c.kind],
    );
  }

  return result;
}
